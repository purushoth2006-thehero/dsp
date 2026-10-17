import { useApp } from '../../state/appContext.js'
import { useToast } from '../../ui/toastContext.js'
import CustomerForm from '../CustomerForm.jsx'

export default function AddCustomer() {
  const { addCustomer } = useApp()
  const toast = useToast()

  const onSubmit = (form) => {
    const result = addCustomer(form)
    if (result.ok) toast(`${form.name.trim()} added.`)
    return result
  }

  return (
    <section className="card narrow">
      <h2>Add customer</h2>
      <CustomerForm submitLabel="Add customer" onSubmit={onSubmit} resetOnSuccess />
    </section>
  )
}
