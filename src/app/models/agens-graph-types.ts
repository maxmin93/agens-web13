import * as _ from 'lodash';

import { IGraph, ILabel, IElement, INode, IEdge, IProperty, IStyle } from './agens-data-types';
import { IRecord, IColumn, IRow } from './agens-data-types';
import { ElemType, ValueType } from '../global.config';

export class Element implements IElement {

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

  constructor(id:string){
    this.group = 'nodes';
    this.data.id = id;
    this.data.labels = new Array<string>();
    this.data.props = new Map<string,any>();
    this.data.size = 0;
  }

  get id():string {
    return this.data.id;
  }
  set id(id:string) {
    this.data.id = id;
  }

  get type():string {
    return this.group;
  };

  get label():string {
    return _.first(this.data.labels);
  };
  set label(name:string) {
    this.data.labels.unshift(name);   // push at first of array
  };
  equalLabel(label:string):boolean {
    return _.indexOf(this.data.labels, label) >= 0;
  }

  getPropertyId():string {
    return this.data.props['id'];
  };
  getPropertyName():string {
    return this.data.props['name'];
  };
  getProperty(key:string):any {
    return this.data.props[key];
  };
  setProperty(key:string, val:any) {
    this.data.props.set(key, val);
  };

};

export class Node extends Element {
}

export class Edge extends Element {

  data: {
    id: string;
    labels: Array<string>;
    props: Map<string,any>;
    size: number;
    source: string;           // only EDGE
    target: string;           // only EDGE
  };

  get source():string {
    return this.data.source;
  }
  set source(id:string) {
    this.data.source = id;
  }

  get target():string {
    return this.data.target;
  }
  set target(id:string) {
    this.data.target = id;
  }
  
}