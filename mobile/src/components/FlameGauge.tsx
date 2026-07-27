import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path } from "react-native-svg";
import { fonts } from "../fonts";
import { Theme } from "../theme";

type Props = {
  theme: Theme;
  pct: number;
  size?: number;
};

const START_ANGLE = -135;
const END_ANGLE = 135;
const SWEEP = END_ANGLE - START_ANGLE;
const REDLINE_PCT = 90;

const AnimatedG = Animated.createAnimatedComponent(G);

function angleForPct(pct: number): number {
  return START_ANGLE + (pct / 100) * SWEEP;
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarPoint(cx, cy, r, startAngle);
  const end = polarPoint(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export default function FlameGauge({ theme, pct, size = 200 }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const needleAngle = useRef(new Animated.Value(START_ANGLE)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        needleAngle.setValue(angleForPct(clamped));
      } else {
        Animated.timing(needleAngle, {
          toValue: angleForPct(clamped),
          duration: 900,
          useNativeDriver: false,
        }).start();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  const cx = size / 2;
  const cy = size / 2 + size * 0.08;
  const trackRadius = size * 0.4;
  const tickOuter = trackRadius + size * 0.02;
  const tickInnerMinor = trackRadius - size * 0.035;
  const tickInnerMajor = trackRadius - size * 0.06;
  const needleLength = trackRadius - size * 0.06;

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const tickPct = i * 10;
    const angle = angleForPct(tickPct);
    const isMajor = tickPct % 25 === 0;
    const outer = polarPoint(cx, cy, tickOuter, angle);
    const inner = polarPoint(cx, cy, isMajor ? tickInnerMajor : tickInnerMinor, angle);
    return { key: tickPct, outer, inner, isMajor };
  });

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size * 0.78}>
        <Path
          d={describeArc(cx, cy, trackRadius, START_ANGLE, END_ANGLE)}
          stroke={theme.border}
          strokeWidth={size * 0.045}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={describeArc(cx, cy, trackRadius, angleForPct(REDLINE_PCT), END_ANGLE)}
          stroke={theme.danger}
          strokeWidth={size * 0.045}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={describeArc(cx, cy, trackRadius, START_ANGLE, angleForPct(clamped))}
          stroke={theme.warning}
          strokeWidth={size * 0.045}
          strokeLinecap="round"
          fill="none"
        />
        {ticks.map((t) => (
          <Line
            key={t.key}
            x1={t.inner.x}
            y1={t.inner.y}
            x2={t.outer.x}
            y2={t.outer.y}
            stroke={theme.subtext}
            strokeWidth={t.isMajor ? 2 : 1}
            strokeLinecap="round"
          />
        ))}
        <AnimatedG origin={`${cx}, ${cy}`} rotation={needleAngle}>
          <Line x1={cx} y1={cy} x2={cx} y2={cy - needleLength} stroke={theme.warning} strokeWidth={3} strokeLinecap="round" />
        </AnimatedG>
        <Circle cx={cx} cy={cy} r={size * 0.035} fill={theme.warning} />
      </Svg>

      <View style={styles.readout}>
        <Text style={[styles.eyebrow, { color: theme.subtext }]}>TODAY&apos;S FIRE</Text>
        <Text style={[styles.value, { color: theme.text }]}>{Math.round(clamped)}</Text>
        <Text style={[styles.unit, { color: theme.subtext }]}>% ACTION SCORE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  readout: { alignItems: "center", marginTop: -8 },
  eyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.2 },
  value: { fontFamily: fonts.monoBold, fontSize: 40, lineHeight: 44, marginTop: 2 },
  unit: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.5, marginTop: 2 },
});
