import { useState, useCallback } from 'react'

interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  danger: boolean
  onConfirm: () => void
}

const initial: ConfirmState = {
  open: false, title: '', message: '', confirmLabel: 'Confirm', danger: false, onConfirm: () => {},
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(initial)

  const confirm = useCallback(
    (options: { title: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> =>
      new Promise((resolve) => {
        setState({
          open: true,
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel || 'Confirm',
          danger: options.danger ?? true,
          onConfirm: () => { resolve(true); setState(s => ({ ...s, open: false })) },
        })
      }),
    [],
  )

  const cancel = useCallback(() => {
    setState(s => ({ ...s, open: false }))
  }, [])

  return { confirmState: state, confirm, cancel }
}
