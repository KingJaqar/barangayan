import { useEffect } from 'react';
import { Image as NativeImage, View } from 'react-native';
const fixture = window as any;
export const Colors = { light: { text:'#000000', background:'#ffffff', backgroundElement:'#F0F0F3', backgroundSelected:'#E0E1E6', textSecondary:'#60646C', primary:'#0F6E5B', onPrimary:'#ffffff', accentRed:'#93000A', accentGreen:'#166534' } };
export const Spacing = { half:2, one:4, two:8, three:16, four:24, five:32, six:64 };
export const Fonts = { mono:'monospace' };
export const useTheme = () => Colors.light;
export const useFontPreference = () => ({fontId:'default'});
export const getMobileFontFamily = () => 'Arial';
export const useSafeAreaInsets = () => ({top:0,bottom:0,left:0,right:0});
export const SafeAreaView = View;
export const Image = NativeImage;
export const Ionicons = () => null;
const refetch = () => {};
export const useProfile = () => ({profile:fixture.profile,refetch,isLoading:false});
export const useFocusEffect = (effect:any) => useEffect(effect,[effect]);
export const useRouter = () => ({replace:(path:string)=>fixture.navigation=path,push:()=>{},back:()=>{}});
export async function pickSupportingFile() {
  if(fixture.pickerError) throw new Error(fixture.pickerError);
  return {name:'certification.pdf',mimeType:'application/pdf',bytes:new Uint8Array([1,2,3])};
}
export const supabase = {
  auth: { getUser:async()=>({data:{user:{id:fixture.profile.id}},error:null}) },
  from: (table:string) => {
    const query:any={select:()=>query,eq:()=>query,single:async()=>({data:table==='id_submissions'?fixture.approved:{id:fixture.requestId,reference_number:'REQ-FORM-126'},error:null})};
    return query;
  },
  rpc: async (name:string,args:any) => {
    fixture.calls.push({name,args});
    return {data:fixture.rpcError?null:fixture.requestId,error:fixture.rpcError};
  },
  storage: {from:()=>({
    createSignedUrl:async()=>({data:{signedUrl:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='},error:null}),
    upload:async()=>{fixture.uploads++;return {error:fixture.uploadError};},
    download:async()=>({data:null,error:fixture.uploadError}),
  })},
};
