import { createContext, useContext } from 'react';
export const FixturePreferences = createContext({scheme:'light',accentColor:'#0F6E5B',fontId:'system'});
export const useThemePreference = () => useContext(FixturePreferences);
export const useFontPreference = () => useContext(FixturePreferences);
