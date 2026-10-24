import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
// Use the reducers shipped with this app's Expo Router, including tab history and
// unhandled Back bubbling. This checks navigation state, without a native renderer.
const { StackRouter, StackActions } = require('expo-router/build/react-navigation/routers/StackRouter');
const { TabRouter } = require('expo-router/build/react-navigation/routers/TabRouter');
const CommonActions = require('expo-router/build/react-navigation/routers/CommonActions');
const appRoutes = path.resolve(import.meta.dirname, '../src/app/(app)');
const options = routeNames => ({ routeNames, routeParamList: {}, routeGetIdList: {} });
const stackOptions = tab => options([...fs.readFileSync(path.join(appRoutes, tab, '_layout.tsx'), 'utf8')
  .matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map(match => match[1]));

function navigationFixture(tabNames = ['home', 'services']) {
  const tabs = TabRouter({ initialRouteName: 'home', backBehavior: 'history' });
  const tabOptions = options(tabNames);
  let state = tabs.getInitialState(tabOptions);
  const stack = StackRouter({});
  const stacks = Object.fromEntries(tabNames.filter(tab => fs.existsSync(path.join(appRoutes, tab, '_layout.tsx')))
    .map(tab => [tab, stackOptions(tab)]));
  const focused = () => state.routes[state.index];
  const setStack = (tab, child) => {
    state = { ...state, routes: state.routes.map(route => route.name === tab ? { ...route, state: child } : route) };
  };
  setStack('home', stack.getInitialState(stacks.home));

  function selectTab(tab) {
    state = tabs.getStateForAction(state, CommonActions.navigate(tab), tabOptions);
    if (!focused().state && stacks[tab]) setStack(tab, stack.getInitialState(stacks[tab]));
  }
  function openScreen(tab, routeName, params) {
    assert.ok(fs.existsSync(path.join(appRoutes, tab, `${routeName}.tsx`)), 'Nested screen must resolve to an app route');
    assert.ok(stacks[tab].routeNames.includes(routeName), 'Nested screen must be registered in its owning stack');
    // First navigation into an unvisited tab initializes its stack at the target.
    const child = state.routes.find(route => route.name === tab).state;
    const next = child
      ? stack.getStateForAction(child, StackActions.push(routeName, params), stacks[tab])
      : stack.getRehydratedState({ routes: [{ name: routeName, params }] }, stacks[tab]);
    state = tabs.getStateForAction(state, CommonActions.navigate(tab), tabOptions);
    setStack(tab, next);
  }
  function open(href) {
    const [, tab, , requestId] = href.split('/');
    openScreen(tab, 'requests/[requestId]', { requestId });
  }
  function back() {
    const tab = focused().name;
    const next = focused().state && stack.getStateForAction(focused().state, CommonActions.goBack(), stacks[tab]);
    if (next) setStack(tab, next);
    else state = tabs.getStateForAction(state, CommonActions.goBack(), tabOptions) ?? state;
  }
  return { open, openScreen, back, selectTab, focused, state: () => state };
}

function verifyTabNavigation() {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/app-tabs.tsx'), 'utf8');
  const primary = [...source.slice(source.indexOf('const TABS ='), source.indexOf('] as const;'))
    .matchAll(/name: '([^']+)'/g)].map(match => match[1]);
  assert.equal(primary.length, 6);
  assert.match(source, /backBehavior="history"/);
  const nav = navigationFixture([...primary, 'settings']);
  let pairs = 0;
  for (const from of primary) for (const to of primary) {
    if (from === to) continue;
    nav.selectTab(from);
    const retained = nav.focused().state;
    nav.selectTab(to);
    assert.equal(nav.focused().name, to);
    assert.equal(nav.state().routes.find(route => route.name === from).state, retained);
    nav.back();
    assert.equal(nav.focused().name, from, 'Root Back returns to the preceding tab');
    pairs++;
  }
  for (const [tab, screen] of [['services', 'requests/[requestId]'], ['health', 'register'], ['reports', '[incidentId]'], ['settings', 'profile']]) {
    nav.selectTab(tab);
    const root = nav.focused().state;
    nav.openScreen(tab, screen, {});
    const nested = nav.focused().state;
    nav.selectTab('home');
    nav.selectTab(tab);
    assert.equal(nav.focused().state, nested, 'Nested screen survives a normal tab change');
    nav.back();
    assert.deepEqual(nav.focused().state.routes, root.routes, 'Nested Back pops inside its own stack');
    nav.back();
    assert.equal(nav.focused().name, 'home', 'Next Back bubbles to tab history');
  }
  return [`${pairs} directed pairs preserve retained stacks and root Back history`, 'Services, Health, Reports and Settings nested screens retain and pop independently (installed reducers; native renderer and auth guards not simulated)'];
}

// Called by the Home UI test with the URL captured from the actual summary CTA.
export function verifyRequestTrackingNavigation(homeHref) {
  const passed = [];
  for (const visitedServices of [false, true]) {
    const nav = navigationFixture();
    if (visitedServices) { nav.selectTab('services'); nav.selectTab('home'); }
    for (let visit = 0; visit < 3; visit++) {
      nav.open(homeHref);
      nav.back(); // Header Back and Android Back dispatch the same GO_BACK action.
      assert.equal(nav.focused().name, 'home', 'Home request Back must return to Home');
      assert.equal(nav.focused().state.routes.at(-1).name, 'index');
      assert.equal(nav.focused().state.routes.length, 1, 'Home tracking entry must be removed');
      nav.selectTab('services');
      assert.equal(nav.focused().state.routes.at(-1).name, 'index', 'Services must not retain a Home request');
      nav.selectTab('home');
    }
    passed.push(`Home → tracking → Back → Services, repeated 3 times (${visitedServices ? 'visited' : 'unvisited'} Services)`);
  }

  const nav = navigationFixture();
  nav.selectTab('services');
  const servicesRoot = nav.focused().state.routes[0];
  const servicesHref = homeHref.replace(/^\/home\//, '/services/');
  nav.open(servicesHref);
  const servicesState = nav.focused().state;
  nav.selectTab('home');
  nav.open(homeHref);
  nav.back();
  assert.equal(nav.state().routes.find(route => route.name === 'services').state, servicesState,
    'Opening the same request from Home must preserve the existing Services stack');
  nav.selectTab('services');
  nav.back();
  assert.equal(nav.focused().name, 'services', 'Services request Back must stay in Services');
  assert.deepEqual(nav.focused().state.routes, [servicesRoot], 'Back must restore the original Services root');
  nav.selectTab('home');
  nav.selectTab('services');
  assert.deepEqual(nav.focused().state.routes, [servicesRoot], 'Services must not reopen a closed tracking screen');
  passed.push('Same request in both tabs preserves independent stacks; Services Back restores its original root');

  // Prove the fixture reproduces the reported stale state with the old Home URL.
  const broken = navigationFixture();
  broken.open(servicesHref);
  broken.back();
  assert.equal(broken.focused().name, 'home');
  broken.selectTab('services');
  assert.equal(broken.focused().state.routes.at(-1).name, 'requests/[requestId]');
  passed.push('Control reproduces the original loop when Home opens the Services-owned URL');
  return passed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify({ passed: [...verifyRequestTrackingNavigation('/home/requests/request-0'), ...verifyTabNavigation()] }));
}
