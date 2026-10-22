import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import Svg, { Path } from 'react-native-svg';
import type { DocumentIconName } from '@/constants/document-icons';

/** Document-and-stamp artwork for Indigency, inheriting the surrounding icon color. */
export function DocumentIcon({ name, ...props }: Omit<ComponentProps<typeof Ionicons>, 'name'> & { name: DocumentIconName }) {
  if (name === 'document-work') {
    const { size = 20, color = 'currentColor' } = props;
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        <Path
          d="M8 22H5A2 2 0 0 1 3 20V4A2 2 0 0 1 5 2H13L19 8V10 M13 2V8H19 M7 7H9 M7 11H11 M7 15H8 M14 14V12H18V14 M12 14H20A2 2 0 0 1 22 16V20A2 2 0 0 1 20 22H12A2 2 0 0 1 10 20V16A2 2 0 0 1 12 14Z M10 17L16 19L22 17 M16 18V20"
          fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (name === 'document-peso') {
    const { size = 20, color = 'currentColor' } = props;
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        <Path
          d="M10 22H5A2 2 0 0 1 3 20V4A2 2 0 0 1 5 2H13L19 8V10 M13 2V8H19 M7 7H9 M7 11H11 M7 15H9 M15 22V13H18A3 3 0 0 1 18 19H15 M13 15H22 M13 17H22"
          fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (name !== 'heart-outline') return <Ionicons {...props} name={name} />;

  const { size = 20, color = 'currentColor' } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M9 22H7C3 22 2 20 2 16V7C2 3 3 2 7 2H14C18 2 19 3 19 7V11 M6 7H15 M6 11H10 M14.5 18C14.5 16.5 13.75 15.7 13.75 14.5C13.75 12.9 14.8 12 16 12C17.2 12 18.25 12.9 18.25 14.5C18.25 15.7 17.5 16.5 17.5 18 M14.5 18H17.5L21 19.3C21.7 19.6 22 20 22 20.7V22H10V20.7C10 20 10.3 19.6 11 19.3Z"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
