import { useCallback, useState } from 'react'
import Modal from './Modal.jsx'

// Replaces window.confirm with an accessible dialog.
//   const [ask, dialog] = useConfirm()
//   if (await ask({ title, message, confirmLabel, danger: true })) { ... }
//   return <>...{dialog}</>
export default function useConfirm() {
  const [state, setState] = useState(null)

  const ask = useCallback((options) => new Promise((resolve) => setState({ ...options, resolve })), [])

  const answer = (value) => {
    state.resolve(value)
    setState(null)
  }

  const dialog = state ? (
    <Modal title={state.title} onClose={() => answer(false)}>
      {state.message && <p>{state.message}</p>}
      <div className="modal-actions">
        <button type="button" className="ghost" onClick={() => answer(false)}>
          {state.cancelLabel ?? 'Cancel'}
        </button>
        <button type="button" className={state.danger ? 'primary danger' : 'primary'} onClick={() => answer(true)} autoFocus>
          {state.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </Modal>
  ) : null

  return [ask, dialog]
}
