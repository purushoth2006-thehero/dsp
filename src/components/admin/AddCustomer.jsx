import { useApp } from '../../state/appContext.js'
import { useToast } from '../../ui/toastContext.js'
import CustomerForm from '../CustomerForm.jsx'

export default function AddCustomer() {
  const { addCustomer } = useApp()
  const toast = useToast()

  const onSubmit = async (form) => {
    const result = await addCustomer(form)
    if (result.ok) toast(`${form.name.trim()} added.`)
    return result
  }

  return (
    <section className="card narrow">
      <h2>Add student</h2>
      <CustomerForm submitLabel="Add student" onSubmit={onSubmit} resetOnSuccess />
    </section>
  )
}
