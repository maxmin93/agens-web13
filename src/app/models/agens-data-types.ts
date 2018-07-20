import { ValueType } from '../global.config';

export interface IDatasource {
  group: string;        // group == 'datasource'
  
  oid: string;
  name: string;
  owner: string;
  desc: string;
  jdbc_url: string;
  version?: number;
  is_dirty: boolean;
};

///////////////////////////////////////////////////////////////

export interface IGraph {
  group: string;        // group == 'graph'

  labels_size: number;
  nodes_size: number;
  edges_size: number;

  labels?: Array<ILabel>;
  nodes?: Array<INode>;
  edges?: Array<IEdge>;
};

export interface ILabel {
  group: string;        // group == 'labels'

  oid: string;
  type: string;         // type = { nodes, edges }
  name: string;
  owner: string;
  desc: string;
  size: number;
  size_not_empty: number;
  is_dirty: boolean;
  properties: Array<IProperty>;
  neighbors: Array<string>;

  _style?: IStyle;            // styles (user property appended after API call)
};

export interface IElement {
  group: string;        // group == 'nodes'
  data: {
    id: string;
    parent?: string;
    labels: Array<string>;
    props: Map<string,any>;
    size: number;
  };
  scratch: {
    _style?: IStyle;          // styles (user property appended after API call)
  };
  classes?: string;

  equalLabel: (label:string) => boolean;
  getPropertyId: () => string;
  getPropertyName: () => string;
  getProperty: (key:string) => any;
  setProperty: (key:string, val:any) => void;
};

export interface INode extends IElement {
}

export interface IEdge extends IElement {
  data: {
    id: string;
    parent?: string;
    labels: Array<string>;
    props: Map<string,any>;
    size: number;
    source: string;           // only EDGE
    target: string;           // only EDGE
  };
};

export interface IProperty {
  key: string;
  type: ValueType;
  size: number;
};

export interface IStyle {  // <== element.scratch('_style')
  color: string;           // NODE: background-color | EDGE: line-color
  width: string;           // NODE: width, height | EDGE: width
  title: string;           // one of keys of props (default: 'name')
};

///////////////////////////////////////////////////////////////

export interface IRecord {
  group: string;                // group == 'record'

  cols_size: number;
  rows_size: number;

  columns?: IColumn[];
  rows?: IRow[];
};

export interface IColumn {
  group: string;                // group == 'columns'

  name: string;
  index: number;
  type: ValueType;
};

export interface IRow {
  group: string;                // group == 'columns'

  index: number;
  row: any[];
};
