import { useEffect, useState } from 'react'
import { Input, Label, Modal, ModalContent, ModalTitle, Segmented } from './ui'
import { barOptions, loadBar, type PlateSpec } from '../lib/plates'
import { frNum, parseDecimal } from '../lib/units'
import { useSettings } from '../store/settings'

/**
 * "62,5 kg = barre 20 + 15 + 5 + 1,25 de chaque côté", drawn as a loaded barbell
 * in competition colours.
 */
export function PlateCalculator({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: number }) {
  const { unit, bar, setBar } = useSettings()
  const barWeight = (bar ?? { kg: 20, lb: 45 })[unit]
  const [value, setValue] = useState('')

  useEffect(() => {
    if (open) setValue(initial && initial > 0 ? frNum(initial, 2) : '')
  }, [open, initial])

  const target = parseDecimal(value)
  const valid = !Number.isNaN(target) && target > 0
  const res = valid ? loadBar(target, barWeight, unit) : null

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-lg">
        <ModalTitle className="t-title text-[26px]">Charger la barre</ModalTitle>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 mt-5 items-end">
          <div>
            <Label htmlFor="plate-target" className="block mb-1.5">Charge totale</Label>
            <div className="relative">
              <Input
                id="plate-target"
                value={value}
                onChange={e => setValue(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                className="num text-[30px] h-14 pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-dim pointer-events-none">{unit}</span>
            </div>
          </div>
          <div>
            <Label className="block mb-1.5">Barre</Label>
            <Segmented
              size="sm"
              className="w-[168px] h-14 items-center"
              value={String(barWeight)}
              onChange={v => setBar(unit, Number(v))}
              options={barOptions(unit).map(b => ({ value: String(b), label: <span className="num text-[18px]">{b}</span> }))}
            />
          </div>
        </div>

        <div className="mt-6 rounded-[var(--radius-card)] bg-surface-2 px-3 pt-5 pb-4">
          <Barbell plates={res?.plates ?? []} />
          <div className="mt-4 text-center min-h-[3.25rem]">
            {!res ? (
              <p className="text-[14px] text-dim">Indique la charge à mettre sur la barre.</p>
            ) : res.tooLight ? (
              <p className="text-[14px] text-dim">C’est moins que la barre seule ({barWeight} {unit}).</p>
            ) : res.plates.length === 0 ? (
              <p className="text-[15px] font-semibold">Barre seule</p>
            ) : (
              <>
                <p className="text-[13px] text-dim">De chaque côté</p>
                <p className="flex flex-wrap items-baseline justify-center gap-x-1.5 mt-0.5">
                  {res.plates.map((p, i) => (
                    <span key={i} className="num text-[26px]">
                      {i > 0 && <span className="text-faint mr-1.5">+</span>}
                      {p.label}
                    </span>
                  ))}
                </p>
                {!res.exact && (
                  <p className="text-[13px] text-dim mt-1.5">
                    Impossible pile avec ces disques : tu seras à <span className="font-semibold text-ink">{frNum(res.loaded, 2)} {unit}</span>.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}

function Barbell({ plates }: { plates: PlateSpec[] }) {
  const H = 96
  const gap = 2
  const sideWidth = plates.reduce((a, p) => a + p.width + gap, 0)
  const sleeveStart = 84 // inner collar distance from centre
  const W = Math.max(320, 2 * (sleeveStart + sideWidth + 18))
  const cx = W / 2
  const drawSide = (dir: 1 | -1) => {
    let x = cx + dir * sleeveStart
    return plates.map((p, i) => {
      const h = H * p.height
      const rx = dir === 1 ? x : x - p.width
      x += dir * (p.width + gap)
      return <rect key={`${dir}-${i}`} x={rx} y={(H - h) / 2 + 12} width={p.width} height={h} rx={2.5} fill={p.color} />
    })
  }
  const reach = Math.max(sleeveStart + sideWidth + 14, sleeveStart + 50)
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full h-auto max-h-36" role="img" aria-label={plates.length ? `${plates.length} disques de chaque côté` : 'Barre vide'}>
      {/* shaft */}
      <rect x={cx - sleeveStart} y={12 + H / 2 - 3} width={sleeveStart * 2} height={6} rx={2} fill="var(--color-dim)" />
      {/* sleeves */}
      <rect x={cx - Math.min(reach, cx - 4)} y={12 + H / 2 - 5} width={Math.min(reach, cx - 4) - sleeveStart + 6} height={10} rx={2} fill="var(--color-faint)" />
      <rect x={cx + sleeveStart - 6} y={12 + H / 2 - 5} width={Math.min(reach, cx - 4) - sleeveStart + 6} height={10} rx={2} fill="var(--color-faint)" />
      {/* collars */}
      <rect x={cx - sleeveStart - 4} y={12 + H / 2 - 12} width={6} height={24} rx={1.5} fill="var(--color-dim)" />
      <rect x={cx + sleeveStart - 2} y={12 + H / 2 - 12} width={6} height={24} rx={1.5} fill="var(--color-dim)" />
      {drawSide(1)}
      {drawSide(-1)}
    </svg>
  )
}