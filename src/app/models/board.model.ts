export interface Field {
  id: string;
  name: string;
  type: string;
  faker?: string;
  isPrimary?: boolean;
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
}

export interface Board extends BoardData {
  id: string;
  name: string;
  users: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
