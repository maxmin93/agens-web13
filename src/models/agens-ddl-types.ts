import { ElemType, ValueType } from '../global.config';

export interface IGraphType {
  
  oid: string;
  name: string;
  owner: string;
  desc: string;
  jdbc_url: string;
  version?: number;
  is_dirty: boolean;

};

export interface ILabelType {

  oid: string;
  type: ElemType;
  name: string;
  owner: string;
  desc: string;
  size: number;
  size_not_empty: number;
  is_dirty: boolean;
  properties: Array<IPropertyType>;
  neighbors: Array<string>;

};

export interface IPropertyType {

  key: string;
  type: ValueType;
  size: number;

};
