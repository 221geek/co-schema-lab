export interface Field {
  id: string;
  name: string;
  type: string;
  faker?: string;
  isPrimary?: boolean;
  /** Référence à un enum nommé du board (quand type === 'enum') */
  enumRef?: string;
  /** @deprecated Utiliser enumRef + enums du board. Conservé pour migration. */
  enumValues?: string[];
}

/** Enum nommé réutilisable par toutes les tables du board */
export interface EnumDef {
  name: string;
  values: string[];
}

export interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  icon: string;
  fields: Field[];
}

export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';

export interface Relationship {
  id: string;
  fromTableId: string;
  toTableId: string;
  fromSide?: ConnectionSide;
  toSide?: ConnectionSide;
  type: '1:1' | '1:N' | 'M:N';
}

export interface BoardData {
  tables: Table[];
  relationships: Relationship[];
  /** Enums nommés réutilisables par toutes les tables */
  enums?: EnumDef[];
}

export interface Board extends BoardData {
  id: string;
  name: string;
  users: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
