/** Which editable data fields each lookup kind has (stored in `lookup_items.data`). */
export interface DataField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'percent' | 'select';
  options?: { value: string; label: string }[];
}

export const LOOKUP_KINDS: { kind: string; label: string; fields: DataField[] }[] = [
  {
    kind: 'category',
    label: 'Kategorie',
    fields: [
      { name: 'share', label: 'Podíl (%)', type: 'percent' },
      { name: 'short', label: 'Krátký název', type: 'text' },
      { name: 'color', label: 'Barva štítku', type: 'text' },
      { name: 'textColor', label: 'Barva textu', type: 'text' },
      { name: 'description', label: 'Popis', type: 'textarea' },
    ],
  },
  {
    kind: 'treatment',
    label: 'Zpracování',
    fields: [
      { name: 'share', label: 'Podíl (%)', type: 'percent' },
      { name: 'description', label: 'Popis', type: 'textarea' },
    ],
  },
  { kind: 'character', label: 'Charakter', fields: [{ name: 'share', label: 'Podíl (%)', type: 'percent' }] },
  {
    kind: 'profile',
    label: 'Profily',
    fields: [
      { name: 'speaker', label: 'Mluvčí', type: 'text' },
      { name: 'hashtag', label: 'Hashtag', type: 'text' },
    ],
  },
  { kind: 'location', label: 'Lokace', fields: [{ name: 'note', label: 'Poznámka', type: 'textarea' }] },
  {
    kind: 'format',
    label: 'Formáty',
    fields: [
      { name: 'family', label: 'Rodina', type: 'text' },
      { name: 'description', label: 'Popis', type: 'textarea' },
      { name: 'goal', label: 'Cíl', type: 'text' },
      {
        name: 'status',
        label: 'Stav',
        type: 'select',
        options: [
          { value: 'untested', label: 'Neotestováno' },
          { value: 'verified', label: 'Ověřeno' },
        ],
      },
    ],
  },
  { kind: 'hook_type', label: 'Typy hooku', fields: [{ name: 'example', label: 'Příklad', type: 'textarea' }] },
  {
    kind: 'cta_type',
    label: 'Typy výzvy',
    fields: [
      {
        name: 'goalMetric',
        label: 'Cílová metrika',
        type: 'select',
        options: [
          { value: 'shares', label: 'Sdílení' },
          { value: 'saves', label: 'Uložení' },
          { value: 'comments', label: 'Komentáře' },
        ],
      },
    ],
  },
];
