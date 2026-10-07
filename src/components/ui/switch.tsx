import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../../lib/cn'

export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-[30px] w-[50px] shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors data-[state=checked]:bg-ink',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-[26px] w-[26px] rounded-full bg-white data-[state=checked]:bg-bg shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-200 data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-[2px]" />
    </SwitchPrimitive.Root>
  )
}