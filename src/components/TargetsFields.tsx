import type { WorkType } from '../api'
import { TagInput } from './TagInput'

export type Targets = { targetTitles: string[]; targetLocations: string[]; workTypes: WorkType[] }

const WORK_TYPE_LABELS: Array<[WorkType, string]> = [
  ['remote', 'Remote'],
  ['hybrid', 'Hybrid'],
  ['onsite', 'On-site'],
]

export function TargetsFields({ value, onChange }: { value: Targets; onChange: (value: Targets) => void }) {
  function toggleWorkType(type: WorkType) {
    const workTypes = value.workTypes.includes(type)
      ? value.workTypes.filter((t) => t !== type)
      : [...value.workTypes, type]
    onChange({ ...value, workTypes })
  }

  return (
    <>
      <TagInput
        label="Job titles"
        hint="Add the roles you want. Press Enter after each one."
        placeholder="e.g. Product Designer"
        values={value.targetTitles}
        onChange={(targetTitles) => onChange({ ...value, targetTitles })}
      />
      <TagInput
        label="Locations"
        hint="Add cities or regions you'd work in. Press Enter after each one."
        placeholder="e.g. Seattle, WA"
        values={value.targetLocations}
        onChange={(targetLocations) => onChange({ ...value, targetLocations })}
      />
      <fieldset className="field">
        <legend>Work type</legend>
        <div className="toggles">
          {WORK_TYPE_LABELS.map(([type, label]) => (
            <label key={type} className="toggle">
              <input
                type="checkbox"
                checked={value.workTypes.includes(type)}
                onChange={() => toggleWorkType(type)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}
