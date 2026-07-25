import React from 'react';
import { Image, Text, View } from 'react-native';
import { ActionButton, Card } from './primitives';
import type { FoafUiTheme } from './theme';

export interface ContactCardContact {
  id: string | number;
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  foafAddress?: string | null;
}

export function ContactCard(props: {
  contact: ContactCardContact;
  theme: FoafUiTheme;
  multiRole?: boolean;
  onPress?: (contact: ContactCardContact) => void;
  onCreateTrustline?: (contact: ContactCardContact) => void;
  onPay?: (contact: ContactCardContact) => void;
}) {
  return (
    <Card theme={props.theme} accessibilityLabel={`Contact ${props.contact.name}`}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: props.theme.spacing.sm }}>
        {props.contact.avatarUrl ? (
          <Image
            accessibilityLabel={`${props.contact.name} avatar`}
            source={{ uri: props.contact.avatarUrl }}
            style={{ borderRadius: 20, height: 40, width: 40 }}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: props.theme.colors.text }}>{props.contact.name}</Text>
          {props.contact.subtitle ? (
            <Text style={{ color: props.theme.colors.mutedText }}>{props.contact.subtitle}</Text>
          ) : null}
          {props.multiRole ? (
            <Text style={{ color: props.theme.colors.mutedText }}>Multiple roles</Text>
          ) : null}
        </View>
      </View>
      {props.onPress ? (
        <ActionButton label="View contact" onPress={() => props.onPress?.(props.contact)} theme={props.theme} />
      ) : null}
      {props.onCreateTrustline ? (
        <ActionButton
          label="Create trustline"
          disabled={!props.contact.foafAddress}
          onPress={() => props.onCreateTrustline?.(props.contact)}
          theme={props.theme}
        />
      ) : null}
      {props.onPay ? (
        <ActionButton label="Pay" onPress={() => props.onPay?.(props.contact)} theme={props.theme} />
      ) : null}
    </Card>
  );
}
