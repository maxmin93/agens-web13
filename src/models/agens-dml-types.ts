import { ElemType, ValueType } from '../global.config';
import { ILabelType } from "./agens-ddl-types";

export interface IGraph {

  meta: Array<ILabelType>,
  nodes: Array<INode>,
  edges: Array<IEdge>

};

export interface INode {

  data: {
    id: string;
    labels: Array<string>;
    props: Map<string,any>;
    size: number;
    $$style?: IStyle;         // styles (user property appended after API call)
  };

  getType?: () => ElemType;
  getLabel?: () => string;
  getPropertyId?: () => string;
  getPropertyName?: () => string;
  getProperty?: (key:string) => any;
  setProperty?: (key:string, val:any) => void;

};

export interface IEdge {

  data: {
    id: string;
    labels: Array<string>;
    props: Map<string,any>;
    size: number;
    source: string;           // only EDGE
    target: string;           // only EDGE
    $$style?: IStyle;         // styles (user property appended after API call)
  };

  getType?: () => ElemType;
  getLabel?: () => string;
  getPropertyId?: () => string;
  getPropertyName?: () => string;
  getProperty?: (key:string) => any;
  setProperty?: (key:string, val:any) => void;

};

export interface IStyle {
  _self: {
    color: string;    // NODE: background-color | EDGE: line-color
    size: string;     // NODE: width, height | EDGE: width
    label: string;    // one of keys of props (default: 'name')
  };
  _label: {
    color: string;
    size: string;
    label: string;
  };
};

export interface IRecord {

  meta: Array<IColumnType>;
  rows: Array<Array<any>>;

};

export interface IColumnType {
  
    name: string;
    index: number;
    type: ValueType;
    
};
