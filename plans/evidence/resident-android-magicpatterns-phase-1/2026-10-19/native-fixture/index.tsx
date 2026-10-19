import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { StatusBadge } from '@/components/status-badge';
import { ProgressBar } from '@/components/progress-bar';
import { SegmentedControl } from '@/components/segmented-control';
import { AuthHeader } from '@/components/auth-header';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { DeleteAccountModal } from '@/components/delete-account-modal';
import { PurposeSheet } from '@/components/services/purpose-sheet';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { FixturePreferences } from './preferences';

const cases = [
  {scheme:'light',accentColor:'#0F6E5B',fontId:'system'},
  {scheme:'light',accentColor:'#2563EB',fontId:'georgia'},
  {scheme:'light',accentColor:'#FFFFFF',fontId:'tahoma'},
  {scheme:'dark',accentColor:'#0F6E5B',fontId:'georgia'},
  {scheme:'dark',accentColor:'#000000',fontId:'tahoma'},
  {scheme:'dark',accentColor:'#2563EB',fontId:'segoe-ui'},
];
function Fixture() {
  const [ready] = useFonts({GideonRoman:require('../../../apps/resident-android-mobile/assets/fonts/GideonRoman-Regular.ttf')});
  const [index,setIndex] = useState(0);
  if (!ready) return null;
  return <SafeAreaProvider><FixturePreferences.Provider value={cases[index]}><Controls index={index} next={()=>setIndex((current)=>(current+1)%cases.length)}/></FixturePreferences.Provider></SafeAreaProvider>;
}
function Controls({index,next}:{index:number;next:()=>void}) {
  const theme=useTheme();
  const reducedMotion=useResidentReducedMotion(true);
  const [segment,setSegment]=useState('one');
  const [dialog,setDialog]=useState(false);
  const [sheet,setSheet]=useState(false);
  return <View style={{flex:1,backgroundColor:theme.resident.card}}>
    <ServiceScreenHeader presentation="resident" title="Resident controls" onBack={()=>{}} compact/>
    <ScrollView contentContainerStyle={{padding:16,gap:12}}>
      <ThemedText>Fixture {index+1}: {cases[index].scheme} {cases[index].accentColor} {cases[index].fontId}</ThemedText>
      <ThemedText>Native reduced motion: {String(reducedMotion)}</ThemedText>
      <PrimaryButton presentation="resident" label="Next appearance" onPress={next}/>
      <Card variant="resident">
        <Card variant="residentRow"><ThemedText>Resident row with selected body font</ThemedText></Card>
        <Divider variant="resident"/>
        <Card variant="residentRow"><StatusBadge presentation="resident" status="in_progress"/><ProgressBar presentation="resident" fraction={0.5} color={theme.resident.accentText}/></Card>
      </Card>
      <TextField presentation="resident" label="Purpose" value="Sample request" onChangeText={()=>{}}/>
      <TextField presentation="resident" label="Required field" error="Please enter a purpose." value="" onChangeText={()=>{}}/>
      <PrimaryButton presentation="resident" label="Submit request"/>
      <PrimaryButton presentation="resident" label="Submit request" loading/>
      <PrimaryButton presentation="resident" label="Disabled control" disabled/>
      <SegmentedControl presentation="resident" segments={[{key:'one',label:'One'},{key:'two',label:'Two'}]} activeKey={segment} onChange={setSegment}/>
      <PrimaryButton presentation="resident" label="Open cancel-only dialog" onPress={()=>setDialog(true)}/>
      <PrimaryButton presentation="resident" label="Open local purpose picker" onPress={()=>setSheet(true)}/>
      <AuthHeader title="Legacy Login" onBack={()=>{}}/>
      <PrimaryButton label="Legacy button"/>
      <TextField label="Legacy input" value="Existing default" onChangeText={()=>{}}/>
    </ScrollView>
    <DeleteAccountModal presentation="resident" visible={dialog} onClose={()=>setDialog(false)} onConfirm={async()=>{throw new Error('Local fixture: no account service is connected.');}}/>
    <PurposeSheet presentation="resident" visible={sheet} title="Local purpose" options={[{code:'one',label:'One'},{code:'two',label:'Two'}]} selected={segment} onSelect={setSegment} onClose={()=>setSheet(false)}/>
  </View>;
}
registerRootComponent(Fixture);
