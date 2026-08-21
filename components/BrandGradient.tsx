import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { gradients, type GradientName } from '@/theme/tokens';

interface BrandGradientProps {
  gradient: GradientName;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// The only place a gradient is painted. Gradient stops live in
// `theme/tokens.ts` as data; this is the renderer that gives them somewhere
// to land, since a plain View cannot paint one.
//
// No consumer until the icon plate lands in Turn 2. It is built now, with the
// tokens, so the dependency resolves and typechecks against the pinned SDK
// before anything is built on top of it. That is not the same as proving it
// paints correctly in Expo Go — that check happens when the icon plate first
// renders it.
export function BrandGradient({ gradient, style, children }: BrandGradientProps) {
  const g = gradients[gradient];
  return (
    <LinearGradient colors={g.colors} start={g.start} end={g.end} style={style}>
      {children}
    </LinearGradient>
  );
}
