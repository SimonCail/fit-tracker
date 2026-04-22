import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { AlertTriangle, Bell, CalendarRange, Check, Download, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { auth } from '../lib/firebase'
import { Button, Input, Label, Sheet, SheetBody, SheetContent, SheetHeader, Switch } from './ui'
import { DAY_KEYS, DAY_LABELS, useSettings, type Theme } from '../store/settings'
import { listSessions, listWeighIns } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import { notificationPermission, requestNotificationPermission } from '../lib/notifications'
import { fcmConfigured, registerFCM, unregisterFCM } from '../lib/fcm'

export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const {
    theme, setTheme, unit, setUnit, restSeconds, setRestSeconds, sound, setSound, vibration, setVibration,
    profile, setProfile, weeklyPlan, setPlanDay, reminders, setReminders,
  } = useSettings()
  const { user } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (open) setPermission(notificationPermission())
  }, [open])

  async function toggleReminders(next: boolean) {
    if (next) {
      const p = await requestNotificationPermission()
      setPermission(p)
      if (p !== 'granted') return
      // Register for FCM push (if VAPID key configured) so the Cloud Function can reach us.
      if (user && fcmConfigured) await registerFCM(user.uid)
    } else if (user) {
      await unregisterFCM(user.uid)
    }
    setReminders({ enabled: next })
  }

  async function onExport() {
    setExporting(true)
    try {
      const [sessions, weighIns] = await Promise.all([listSessions(500), listWeighIns(500)])
      const payload = {
        exportedAt: new Date().toISOString(),
        user: user?.email ?? null,
        sessions,
        weighIns,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fit-tracker-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-dim)] font-medium">Réglages</p>
          <h2 className="font-display text-3xl mt-1">Préférences</h2>
        </SheetHeader>
        <SheetBody>
          <Section title="Apparence">
            <div className="flex gap-2">
              <ThemeChoice value="light" current={theme} onChange={setTheme} icon={<Sun size={16} />} label="Clair" />
              <ThemeChoice value="dark" current={theme} onChange={setTheme} icon={<Moon size={16} />} label="Sombre" />
              <ThemeChoice value="system" current={theme} onChange={setTheme} icon={<Monitor size={16} />} label="Auto" />
            </div>
          </Section>

          <Section title="Unité de poids">
            <div className="flex gap-2">
              <Choice selected={unit === 'kg'} onClick={() => setUnit('kg')} label="kg" />
              <Choice selected={unit === 'lb'} onClick={() => setUnit('lb')} label="lb" />
            </div>
          </Section>

          <Section title="Timer de repos">
            <div className="flex items-center gap-3 mb-3">
              <Input
                type="number"
                min={15}
                max={600}
                step={15}
                value={restSeconds}
                onChange={e => setRestSeconds(Math.max(15, Math.min(600, Number(e.target.value) || 90)))}
                className="w-28"
                inputMode="numeric"
              />
              <span className="text-sm text-[color:var(--color-text-dim)]">secondes par défaut</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[60, 90, 120, 180, 240].map(s => {
                const active = restSeconds === s
                return (
                  <button
                    key={s}
                    onClick={() => setRestSeconds(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer active:scale-[0.95] ${
                      active
                        ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]'
                        : 'border-[color:var(--color-border)] text-[color:var(--color-text-dim)] hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-2)]/50'
                    }`}
                  >
                    {s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between mt-4 py-2">
              <span className="text-sm">Son à la fin</span>
              <Switch checked={sound} onCheckedChange={setSound} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Vibration</span>
              <Switch checked={vibration} onCheckedChange={setVibration} />
            </div>
          </Section>

          <Section title="Profil">
            <div className="space-y-3">
              <FieldRow label="Prénom">
                <Input
                  value={profile.name ?? ''}
                  onChange={e => setProfile({ name: e.target.value || null })}
                  placeholder="Optionnel"
                />
              </FieldRow>
              <FieldRow label="Taille (cm)">
                <Input
                  type="number"
                  min={120}
                  max={230}
                  value={profile.heightCm ?? ''}
                  onChange={e => setProfile({ heightCm: e.target.value ? Number(e.target.value) : null })}
                  placeholder="180"
                  inputMode="numeric"
                />
              </FieldRow>
              <FieldRow label="Année de naissance">
                <Input
                  type="number"
                  min={1920}
                  max={new Date().getFullYear()}
                  value={profile.birthYear ?? ''}
                  onChange={e => setProfile({ birthYear: e.target.value ? Number(e.target.value) : null })}
                  placeholder="1995"
                  inputMode="numeric"
                />
              </FieldRow>
              <FieldRow label="Sexe">
                <div className="flex gap-2">
                  <Choice selected={profile.sex === 'male'} onClick={() => setProfile({ sex: 'male' })} label="H" />
                  <Choice selected={profile.sex === 'female'} onClick={() => setProfile({ sex: 'female' })} label="F" />
                  <Choice selected={profile.sex === 'other'} onClick={() => setProfile({ sex: 'other' })} label="Autre" />
                </div>
              </FieldRow>
            </div>
          </Section>

          <Section title="Planning hebdo" icon={<CalendarRange size={12} />}>
            <p className="text-xs text-[color:var(--color-text-dim)] mb-3 leading-relaxed">
              Définis ce que tu comptes faire chaque jour. Sera affiché sur l'accueil et servira aux rappels.
            </p>
            <div className="space-y-2">
              {DAY_KEYS.map(day => (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium w-10 shrink-0">
                    {DAY_LABELS[day].slice(0, 3)}
                  </span>
                  <Input
                    value={weeklyPlan[day] ?? ''}
                    onChange={e => setPlanDay(day, e.target.value || null)}
                    placeholder="Ex: Pecs & triceps, Repos…"
                    className="h-10 text-sm"
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Rappels" icon={<Bell size={12} />}>
            <div className="flex items-center justify-between py-2">
              <div className="flex-1 pr-3">
                <span className="text-sm block">Me notifier si j'oublie</span>
                <p className="text-xs text-[color:var(--color-text-dim)] mt-0.5 leading-relaxed">
                  Si la séance prévue n'est pas logguée et qu'on a dépassé l'heure, tu reçois un rappel.
                </p>
              </div>
              <Switch checked={reminders.enabled && permission === 'granted'} onCheckedChange={toggleReminders} />
            </div>
            {reminders.enabled && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm text-[color:var(--color-text-dim)] w-32 shrink-0">Heure du rappel</span>
                <Input
                  type="time"
                  value={reminders.time}
                  onChange={e => setReminders({ time: e.target.value || '20:00' })}
                  className="w-32"
                />
              </div>
            )}
            {permission === 'denied' && (
              <div className="mt-3 rounded-xl p-3 bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-xs text-[color:var(--color-text-dim)] flex gap-2">
                <AlertTriangle size={14} className="text-[color:var(--color-danger)] shrink-0 mt-0.5" />
                <p>Les notifications sont bloquées par ton navigateur. Autorise-les dans les réglages du site.</p>
              </div>
            )}
            {permission === 'granted' && reminders.enabled && (
              <p className="text-[10px] text-[color:var(--color-text-dim)] mt-3 flex items-center gap-1">
                <Check size={10} className="text-[color:var(--color-success)]" />
                Le rappel apparaît quand tu reviens sur l'app après l'heure prévue (limitation navigateur sans backend).
              </p>
            )}
          </Section>

          <Section title="Données">
            <Button variant="secondary" onClick={onExport} disabled={exporting} className="w-full justify-start">
              <Download size={16} /> {exporting ? 'Export…' : 'Exporter en JSON'}
            </Button>
          </Section>

          <Section title="Compte">
            <p className="text-sm text-[color:var(--color-text-dim)] mb-3 break-all">
              {user?.email ?? user?.displayName ?? 'Connecté'}
            </p>
            <Button variant="danger" onClick={() => signOut(auth)} className="w-full justify-start">
              <LogOut size={16} /> Se déconnecter
            </Button>
          </Section>

          <p className="text-xs text-center text-[color:var(--color-text-dim)] mt-8 mb-2">
            Fit Tracker · PWA
          </p>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-[color:var(--color-border)] last:border-b-0">
      <Label className="flex items-center gap-1.5 mb-3">
        {icon} {title}
      </Label>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[color:var(--color-text-dim)] w-32 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function ThemeChoice({
  value,
  current,
  onChange,
  icon,
  label,
}: {
  value: Theme
  current: Theme
  onChange: (v: Theme) => void
  icon: React.ReactNode
  label: string
}) {
  const active = value === current
  return (
    <button
      onClick={() => onChange(value)}
      className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.97] ${
        active
          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]'
          : 'border-[color:var(--color-border)] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-2)]/50'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

function Choice({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-11 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer active:scale-[0.97] ${
        selected
          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]'
          : 'border-[color:var(--color-border)] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-2)]/50'
      }`}
    >
      {label}
    </button>
  )
}
