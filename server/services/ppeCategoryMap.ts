import type { NFRSCategory } from '../../src/types/index.js';

export interface PPEClassDefinition {
  categoryId: string;
  label: string;
  tbCategories: NFRSCategory[];
}

export const PPE_CLASSES: PPEClassDefinition[] = [
  { categoryId: 'Land', label: 'Land', tbCategories: ['ppe_land'] },
  { categoryId: 'Building', label: 'Buildings', tbCategories: ['ppe_buildings'] },
  {
    categoryId: 'OfficeEquipment',
    label: 'Furniture, Computers & Office Equipment',
    tbCategories: ['ppe_office_equipment', 'ppe_furniture', 'ppe_computers'],
  },
  { categoryId: 'Vehicle', label: 'Vehicles', tbCategories: ['ppe_vehicles'] },
  { categoryId: 'PlantMachinery', label: 'Plant & Machinery', tbCategories: ['ppe_plant_machinery'] },
  { categoryId: 'Intangible', label: 'Intangibles / Software', tbCategories: ['ppe_intangibles'] },
  { categoryId: 'UnderConstruction', label: 'Capital Work in Progress', tbCategories: ['ppe_cwip'] },
];

const PPE_CLASS_ALIASES: Record<string, string> = {
  land: 'Land',
  building: 'Building',
  buildings: 'Building',
  ppe_buildings: 'Building',
  ppe_land: 'Land',
  officeequipment: 'OfficeEquipment',
  office_equipment: 'OfficeEquipment',
  ppe_office_equipment: 'OfficeEquipment',
  ppe_furniture: 'OfficeEquipment',
  ppe_computers: 'OfficeEquipment',
  furniture: 'OfficeEquipment',
  computers: 'OfficeEquipment',
  vehicle: 'Vehicle',
  vehicles: 'Vehicle',
  ppe_vehicles: 'Vehicle',
  plantmachinery: 'PlantMachinery',
  plant_machinery: 'PlantMachinery',
  ppe_plant_machinery: 'PlantMachinery',
  intangible: 'Intangible',
  intangibles: 'Intangible',
  ppe_intangibles: 'Intangible',
  underconstruction: 'UnderConstruction',
  cwip: 'UnderConstruction',
  ppe_cwip: 'UnderConstruction',
  wip: 'UnderConstruction',
};

export function normalizePPEClassId(value: string | undefined): string {
  if (!value) return 'OfficeEquipment';
  const direct = PPE_CLASSES.find((c) => c.categoryId === value);
  if (direct) return direct.categoryId;
  const key = value.toLowerCase().replace(/[\s_-]/g, '');
  return PPE_CLASS_ALIASES[key] ?? PPE_CLASS_ALIASES[value.toLowerCase()] ?? 'OfficeEquipment';
}

export function ppeClassLabel(categoryId: string): string {
  return PPE_CLASSES.find((c) => c.categoryId === categoryId)?.label ?? categoryId;
}

export function ppeTbCategories(categoryId: string): NFRSCategory[] {
  const normalized = normalizePPEClassId(categoryId);
  return PPE_CLASSES.find((c) => c.categoryId === normalized)?.tbCategories ?? [];
}
