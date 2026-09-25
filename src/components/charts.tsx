"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BRAND = "#4944e9";
const GREEN = "#10b981";
const GRID = "#f0f0f3";
const AXIS = { fontSize: 11, fill: "#a1a1aa" };

function formatDay(d: string) {
  const [, m, day] = d.split("-");
  return `${Number(day)}/${Number(m)}`;
}

const tooltipStyle = {
  contentStyle: { borderRadius: 10, border: "1px solid #e4e4e7", boxShadow: "0 8px 24px -12px rgb(0 0 0 / .2)", fontSize: 12 },
  labelStyle: { color: "#71717a", marginBottom: 4 },
};

export function ActivityChart({ data, height = 240 }: { data: { date: string; sent: number; replies: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.18} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gReplies" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity={0.18} />
              <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatDay} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} labelFormatter={(l) => formatDay(String(l))} />
          <Area type="monotone" dataKey="sent" name="Emails sent" stroke={BRAND} strokeWidth={2} fill="url(#gSent)" />
          <Area type="monotone" dataKey="replies" name="Replies" stroke={GREEN} strokeWidth={2} fill="url(#gReplies)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FunnelChart({ data, height = 240 }: { data: { label: string; value: number }[]; height?: number }) {
  const shades = ["#cdd4ff", "#a8b3fe", "#7f88fb", "#5d63f5", "#4944e9", "#3d36ce", "#10b981", "#059669"];
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={112} tick={{ fontSize: 12, fill: "#52525b" }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "#f4f4f5" }} />
          <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]} barSize={18} label={{ position: "right", fontSize: 12, fill: "#3f3f46" }}>
            {data.map((_, i) => (
              <Cell key={i} fill={shades[Math.min(i, shades.length - 1)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBarChart({ data, height = 220, color = BRAND }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "#f4f4f5" }} />
          <Bar dataKey="value" name="Leads" fill={color} radius={[6, 6, 0, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
