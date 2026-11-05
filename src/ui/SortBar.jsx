import { Field } from './Field.jsx'

// "Sort by" drop-down plus an ascending / descending button.
export default function SortBar({ options, sort, onChange }) {
  return (
    <>
      <Field label="Sort by">
        <select value={sort.key} onChange={(e) => onChange({ ...sort, key: e.target.value })}>
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </Field>
      <button
        type="button"
        className="ghost"
        onClick={() => onChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
        aria-label={sort.dir === 'asc' ? 'Ascending: click for descending' : 'Descending: click for ascending'}
        title={sort.dir === 'asc' ? 'Ascending (A to Z, oldest first)' : 'Descending (Z to A, newest first)'}
      >
        {sort.dir === 'asc' ? '↑ Ascending' : '↓ Descending'}
      </button>
    </>
  )
}
