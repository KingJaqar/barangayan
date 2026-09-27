import { Body, Destination, Screen, Unavailable } from '../../../components/ui';
export default function Maps() { return <Screen><Unavailable service="Maps and directions" /><Body>Map and routing services require approval before they are available in this app.</Body><Destination title="Emergency information" href="/emergency" /></Screen>; }
