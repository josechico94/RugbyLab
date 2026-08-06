// src/shared/components/ui.tsx
import React from 'react'

// ── Avatar ────────────────────────────────────────────────────
interface AvatarProps {
  initials: string
  size?: number
  bg?: string
  color?: string
  className?: string
}
export function Avatar({ initials, size = 36, bg = '#E8F5EE', color = '#1B6B3A', className = '' }: AvatarProps) {
  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.33, fontWeight: 700, flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

// ── Badge / Pill ──────────────────────────────────────────────
type PillVariant = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray' | 'gold'
interface PillProps { variant?: PillVariant; children: React.ReactNode }
export function Pill({ variant = 'gray', children }: PillProps) {
  return <span className={`pill pill-${variant}`}>{children}</span>
}

export function statusPill(status: string) {
  const map: Record<string, PillVariant> = {
    Disponible: 'green', Lesionado: 'red', Duda: 'amber', Suspendido: 'gray',
  }
  return <Pill variant={map[status] ?? 'gray'}>{status}</Pill>
}

export function rolePill(role: string) {
  const map: Record<string, { label: string; variant: PillVariant }> = {
    admin:          { label: 'admin',    variant: 'amber'  },
    cuerpo_tecnico: { label: 'técnico',  variant: 'blue'   },
    jugador:        { label: 'jugador',  variant: 'green'  },
  }
  const { label, variant } = map[role] ?? { label: role, variant: 'gray' }
  return <Pill variant={variant}>{label}</Pill>
}

// ── Button ────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline'
  size?: 'sm' | 'md'
}
export function Btn({ variant = 'outline', size = 'md', className = '', children, ...props }: BtnProps) {
  return (
    <button
      className={`btn ${variant === 'primary' ? 'btn-primary' : ''} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Stat Card ─────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string
  delta?: string
  deltaType?: 'up' | 'warn' | 'neutral'
  accentColor?: string
}
export function StatCard({ label, value, delta, deltaType = 'neutral', accentColor = '#1B6B3A' }: StatCardProps) {
  const deltaColor = deltaType === 'up' ? '#1B6B3A' : deltaType === 'warn' ? '#B45309' : '#7A9485'
  return (
    <div className="stat-card fade-in">
      <div className="stat-accent" style={{ background: accentColor }} />
      <div style={{ fontSize: 11, color: '#7A9485', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0D1F14', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: 11, marginTop: 6, fontWeight: 500, color: deltaColor }}>
          {delta}
        </div>
      )}
    </div>
  )
}

// ── Section Header ────────────────────────────────────────────
interface SectionHeaderProps { title: string; action?: React.ReactNode }
export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0D1F14', letterSpacing: '-0.01em' }}>{title}</h2>
      {action}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────
export function EmptyState({ icon = '📭', title = 'Sin datos', desc = '' }: { icon?: string; title?: string; desc?: string }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9AB5A8' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#4A6358', marginBottom: 4 }}>{title}</div>
      {desc && <div style={{ fontSize: 12 }}>{desc}</div>}
    </div>
  )
}

// ── Num Badge (camiseta) ──────────────────────────────────────
export function NumBadge({ num }: { num: number }) {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: '50%',
      background: '#0A2218', color: '#fff',
      fontSize: 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {num}
    </div>
  )
}

// ── Progress Bar ──────────────────────────────────────────────
interface ProgressBarProps { label: string; current: number; total: number; unit?: string; fill?: string; track?: string }
export function ProgressBar({ label, current, total, unit = 'g', fill = '#1B6B3A', track = '#E8F5EE' }: ProgressBarProps) {
  const pct = Math.min(Math.round((current / total) * 100), 100)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1F14' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#7A9485' }}>{current}{unit} / {total}{unit}</span>
      </div>
      <div style={{ height: 8, background: track, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: fill, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ── Card with header ──────────────────────────────────────────
interface CardProps { title?: string; action?: React.ReactNode; children: React.ReactNode; padding?: boolean }
export function Card({ title, action, children, padding = false }: CardProps) {
  return (
    <div className="card">
      {title && (
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F4F2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1F14' }}>{title}</span>
          {action}
        </div>
      )}
      <div style={padding ? { padding: '16px 18px' } : {}}>
        {children}
      </div>
    </div>
  )
}

// ── Loading spinner ───────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid #E8F5EE',
        borderTopColor: '#1B6B3A',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
