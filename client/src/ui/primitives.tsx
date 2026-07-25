import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { FoafUiTheme } from './theme';

export function ActionButton(props: {
  label: string;
  onPress: () => void;
  theme: FoafUiTheme;
  disabled?: boolean;
  danger?: boolean;
}) {
  const color = props.danger ? props.theme.colors.danger : props.theme.colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        backgroundColor: color,
        borderRadius: props.theme.radii.md,
        opacity: props.disabled ? 0.45 : pressed ? 0.78 : 1,
        paddingHorizontal: props.theme.spacing.md,
        paddingVertical: props.theme.spacing.sm,
      })}
    >
      <Text style={{ color: props.theme.colors.primaryText, textAlign: 'center' }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function FieldLabel(props: {
  children: React.ReactNode;
  theme: FoafUiTheme;
}) {
  return (
    <Text style={{ color: props.theme.colors.mutedText, marginBottom: props.theme.spacing.xs }}>
      {props.children}
    </Text>
  );
}

export function Card(props: {
  children: React.ReactNode;
  theme: FoafUiTheme;
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessibilityLabel={props.accessibilityLabel}
      style={{
        backgroundColor: props.theme.colors.surface,
        borderColor: props.theme.colors.border,
        borderRadius: props.theme.radii.lg,
        borderWidth: 1,
        gap: props.theme.spacing.sm,
        padding: props.theme.spacing.md,
      }}
    >
      {props.children}
    </View>
  );
}
