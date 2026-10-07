import { useEffect, useState, type ReactNode } from 'react'
import { signOut } from 'firebase/auth'
import { Download, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { auth } from '../lib/firebase'
import { Button, Segmented, Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, Switch } from './ui'
import { DAY_KEYS, DAY_LABELS, useSettings } from '../store/settings'
import { listSessions, listWeighIns } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import { notificationPermission, requestNotificationPermission } from '../lib/notifications'
import { fcmConfigured, registerFCM, unregisterFCM } from '../lib/fcm'
import { cn } from '../lib/cn'

const REST_PRESETS = [60, 90, 120, 180]

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
      const payload = { exportedAt: new Date().toISOString(), user: user?.email ?? null, sessions, weighIns }
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

  const customRest = !REST_PRESETS.includes(restSeconds)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="t-title text-[32px]">Réglages</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-7 pt-3">
          <Group title="Affichage">
            <Row label="Thème">
              <Segmented
                size="sm"
                className="w-[200px]"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'light', label: <Sun size={16} aria-label="Clair" /> },
                  { value: 'dark', label: <Moon size={16} aria-label="Sombre" /> },
                  { value: 'system', label: <Monitor size={16} aria-label="Comme l’appareil" /> },
                ]}
              />
            </Row>
            <Row label="Unité">
              <Segmented
                size="sm"
                className="w-[130px]"
                value={unit}
                onChange={setUnit}
                options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
              />
            </Row>
          </Group>

          <Group title="Minuteur de repos">
            <div className="px-4 py-3.5 hairline-b">
              <div className="grid grid-cols-5 gap-1.5">
                {REST_PRESETS.map(s => (
                  <button
                    key={s}
                    onClick={() => setRestSeconds(s)}
                    aria-pressed={restSeconds === s}
                    className={cn(
                      'h-11 rounded-[12px] num text-[20px] cursor-pointer transition-colors',
                      restSeconds === s ? 'bg-ink text-bg' : 'bg-surface-2 text-ink',
                    )}
                  >
                    {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
                  </button>
                ))}
                <label className={cn('relative h-11 rounded-[12px] flex items-center justify-center', customRest ? 'bg-ink text-bg' : 'bg-surface-2 text-ink')}>
                  <input
                    type="number"
                    min={15}
                    max={600}
                    step={15}
                    value={restSeconds}
                    onChange={e => setRestSeconds(Math.max(15, Math.min(600, Number(e.target.value) || 90)))}
                    inputMode="numeric"
                    aria-label="Durée personnalisée en secondes"
                    className="w-full h-full bg-transparent text-center num text-[20px] outline-none pr-3"
                  />
                  <span className="absolute right-2 text-[11px] font-semibold opacity-70 pointer-events-none">s</span>
                </label>
              </div>
            </div>
            <Row label="Son à la fin"><Switch checked={sound} onCheckedChange={setSound} /></Row>
            <Row label="Vibration"><Switch checked={vibration} onCheckedChange={setVibration} /></Row>
          </Group>

          <Group title="Profil">
            <FieldRow label="Prénom">
              <InlineInput value={profile.name ?? ''} onChange={v => setProfile({ name: v || null })} placeholder="Facultatif" />
            </FieldRow>
            <FieldRow label="Taille">
              <InlineInput
                value={profile.heightCm ? String(profile.heightCm) : ''}
                onChange={v => setProfile({ heightCm: v ? Number(v) : null })}
                placeholder="cm"
                inputMode="numeric"
                suffix={profile.heightCm ? 'cm' : undefined}
              />
            </FieldRow>
            <FieldRow label="Année de naissance">
              <InlineInput
                value={profile.birthYear ? String(profile.birthYear) : ''}
                onChange={v => setProfile({ birthYear: v ? Number(v) : null })}
                placeholder="1998"
                inputMode="numeric"
              />
            </FieldRow>
            <Row label="Sexe">
              <Segmented
                size="sm"
                className="w-[180px]"
                value={profile.sex ?? ('' as 'male')}
                onChange={v => setProfile({ sex: v })}
                options={[{ value: 'female', label: 'F' }, { value: 'male', label: 'H' }, { value: 'other', label: 'Autre' }]}
              />
            </Row>
          </Group>

          <Group title="Programme de la semaine" hint="Affiché sur l’accueil le jour venu, et utilisé pour les rappels.">
            {DAY_KEYS.map(day => (
              <FieldRow key={day} label={DAY_LABELS[day]}>
                <InlineInput value={weeklyPlan[day] ?? ''} onChange={v => setPlanDay(day, v || null)} placeholder="Repos" />
              </FieldRow>
            ))}
          </Group>

          <Group
            title="Rappels"
            hint={
              permission === 'denied'
                ? 'Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis réactive le rappel.'
                : 'Si une séance est prévue et que rien n’est noté à l’heure choisie, tu reçois une notification.'
            }
          >
            <Row label="Me rappeler ma séance">
              <Switch checked={reminders.enabled && permission === 'granted'} onCheckedChange={toggleReminders} />
            </Row>
            {reminders.enabled && permission === 'granted' && (
              <Row label="Heure">
                <input
                  type="time"
                  value={reminders.time}
                  onChange={e => setReminders({ time: e.target.value || '20:00' })}
                  className="h-10 rounded-[10px] bg-surface-2 px-3 num text-[20px] outline-none"
                />
              </Row>
            )}
          </Group>

          <Group title="Compte">
            <div className="px-4 py-3.5 hairline-b text-[15px] text-dim break-all">{user?.email ?? user?.displayName ?? 'Connecté'}</div>
            <button onClick={onExport} disabled={exporting} className="w-full flex items-center gap-3 px-4 h-[52px] hairline-b text-left cursor-pointer active:bg-surface-2 disabled:opacity-50">
              <Download size={18} className="text-dim" />
              <span className="flex-1 font-medium">{exporting ? 'Export en cours…' : 'Exporter mes données (JSON)'}</span>
            </button>
            <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-4 h-[52px] text-left cursor-pointer active:bg-surface-2 text-danger">
              <LogOut size={18} />
              <span className="flex-1 font-medium">Se déconnecter</span>
            </button>
          </Group>
          <Button variant="ghost" className="w-full sm:hidden" onClick={() => onOpenChange(false)}>Fermer</Button>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[13px] font-semibold text-dim px-1 mb-2">{title}</h3>
      <div className="rounded-[12px] bg-surface overflow-hidden [&>*:last-child]:shadow-none">{children}</div>
      {hint && <p className="text-[13px] text-faint px-1 mt-2 leading-snug">{hint}</p>}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 min-h-[56px] py-2 hairline-b">
      <span className="font-medium">{label}</span>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-3 px-4 min-h-[52px] hairline-b cursor-text">
      <span className="font-medium shrink-0 w-[42%] truncate">{label}</span>
      {children}
    </label>
  )
}

function InlineInput({
  value,
  onChange,
  placeholder,
  inputMode,
  suffix,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'numeric' | 'text'
  suffix?: string
}) {
  return (
    <span className="flex-1 flex items-baseline justify-end gap-1 min-w-0">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full min-w-0 bg-transparent text-right text-[16px] text-dim focus:text-ink placeholder:text-faint outline-none h-11"
      />
      {suffix && <span className="text-[14px] text-faint">{suffix}</span>}
    </span>
  )
}