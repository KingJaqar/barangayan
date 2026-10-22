import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Markdown } from '../../components/markdown';
import { Body, Card, EmptyState, Notice, ResourceState, Screen, Segmented, SymbolIcon } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { openExternal } from '../../lib/open-external';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { contactRows, imageUrl, purposes } from './about-model';
import { appVersionLabel } from './app-version';
import { INFORMATION_COPY } from './copy';

type Member = { id: string; name: string; role: string; bio: string; photo_url: string | null };

/** About Us (A49): identity and the running binary version, Mission and Vision, History, Contact and the development team. */
export function AboutScreen() {
  const api = useApi();
  const resource = useResource('about-us', (signal) => api.aboutUs(signal));
  const data = resource.data;
  return <Screen>
    <ResourceState loading={resource.loading && data === undefined} error={data === undefined ? resource.error : undefined} retry={() => void resource.refresh()} />
    {resource.error && data !== undefined && <Body role="footnote" tone="danger">{INFORMATION_COPY.aboutRefreshFailed}</Body>}
    {data === null && <><EmptyState title={INFORMATION_COPY.aboutEmpty.title} message={INFORMATION_COPY.aboutEmpty.message} /><Card><Body tone="secondary">{appVersionLabel()}</Body></Card></>}
    {data && <>
      <Identity title={data.about.title} logo={data.about.logo_url} />
      <Purpose about={data.about} />
      {data.about.history.trim() !== '' && <History text={data.about.history} />}
      <Contact about={data.about} />
      <Team team={data.team} />
    </>}
  </Screen>;
}

function Identity({ title, logo }: { title: string; logo: string | null }) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  const url = imageUrl(logo);
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
      {url && !failed
        ? <Image source={{ uri: url }} accessibilityLabel={title || INFORMATION_COPY.logoLabel} accessibilityIgnoresInvertColors onError={() => setFailed(true)} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceSelected }} />
        : <View accessibilityElementsHidden style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center' }}><SymbolIcon name="building.2" color={colors.primary} size={26} /></View>}
      <View style={{ flex: 1, gap: space[1] }}><Body heading>{title}</Body><Body tone="secondary">{appVersionLabel()}</Body></View>
    </View>
  </Card>;
}

function Purpose({ about }: { about: { mission: string; vision: string } }) {
  const items = purposes(about);
  const [selected, setSelected] = useState<'mission' | 'vision'>(items[0]?.key ?? 'mission');
  if (items.length === 0) return null;
  const active = items.find((item) => item.key === selected) ?? items[0];
  return <Card>
    {items.length > 1 && <Segmented<'mission' | 'vision'> label="Mission or vision" options={items.map((item) => ({ value: item.key, label: item.label }))} selected={active.key} onChange={setSelected} />}
    {items.length === 1 && <Body heading role="headline">{active.label}</Body>}
    <Markdown source={active.text} />
  </Card>;
}

function History({ text }: { text: string }) {
  const colors = useColors();
  const type = useType();
  const [open, setOpen] = useState(false);
  const label = open ? INFORMATION_COPY.historyLess : INFORMATION_COPY.historyMore;
  return <Card>
    <Body heading role="headline">History</Body>
    {open ? <Markdown source={text} /> : <Text numberOfLines={4} style={[type.body, { color: colors.textSecondary }]}>{text}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)}
      style={{ minHeight: layout.controlMin, justifyContent: 'center' }}><Text style={[type.body, { color: colors.primary }]}>{label}</Text></Pressable>
  </Card>;
}

function Contact({ about }: { about: { contact_email: string | null; contact_phone: string | null; address: string | null } }) {
  const colors = useColors();
  const type = useType();
  const [failed, setFailed] = useState(false);
  const rows = contactRows(about);
  if (rows.length === 0) return null;
  return <Card>
    <Body heading role="headline">{INFORMATION_COPY.contactTitle}</Body>
    {rows.map((row) => {
      const target = row.url;
      const content = <View style={{ minHeight: layout.listRowMin, justifyContent: 'center', gap: space[1] }}>
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{row.label}</Text>
        <Text selectable style={[type.body, { color: target ? colors.primary : colors.textPrimary }]}>{row.value}</Text>
      </View>;
      return target
        ? <Pressable key={row.key} accessibilityRole="link" accessibilityLabel={`${row.label}: ${row.value}`} onPress={() => { void openExternal(target).then((opened) => setFailed(!opened)); }}>{content}</Pressable>
        : <View key={row.key} accessible accessibilityLabel={`${row.label}: ${row.value}`}>{content}</View>;
    })}
    {failed && <Notice tone="danger" message={INFORMATION_COPY.contactOpenFailed} />}
  </Card>;
}

function Team({ team }: { team: Member[] }) {
  const colors = useColors();
  if (team.length === 0) return null;
  return <Card>
    <Body heading role="headline">{INFORMATION_COPY.teamTitle}</Body>
    {team.map((member) => <DeveloperCard key={member.id} member={member} border={colors.border} />)}
  </Card>;
}

function DeveloperCard({ member, border }: { member: Member; border: string }) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  const url = imageUrl(member.photo_url);
  return <View accessible accessibilityLabel={[member.name, member.role, member.bio].filter(Boolean).join(', ')} style={{ flexDirection: 'row', gap: space[3], paddingTop: space[3], borderTopWidth: 1, borderTopColor: border }}>
    {url && !failed
      ? <Image source={{ uri: url }} accessibilityIgnoresInvertColors onError={() => setFailed(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSelected }} />
      : <View style={{ width: 44, height: 44, borderRadius: radius.xl, backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center' }}><SymbolIcon name="person" color={colors.textSecondary} size={20} /></View>}
    <View style={{ flex: 1, gap: space[1] }}>
      <Body heading role="headline">{member.name}</Body>
      {member.role !== '' && <Body tone="secondary">{member.role}</Body>}
      {member.bio !== '' && <Body role="footnote" tone="secondary">{member.bio}</Body>}
    </View>
  </View>;
}
