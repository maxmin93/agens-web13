import { StateType } from '../app.config';
import { ILabel } from './agens-data-types';

export interface ILogs {

  id: number;
  userName: string;
  userIp: string;
  query: string;
  state: StateType;
  message: string;
  create_dt: number;    // timestamp
  update_dt: number;    // timestamp

};

export interface IProject {

  id: number;
  userName?: string;
  userIp?: string;
  title: string;
  description: string;
  create_dt?: number;    // timestamp
  update_dt?: number;    // timestamp
  sql: string;
  graph: any;           // IGraph : labels, nodes, edges
  image?: Blob;
  // graph_json?: string;    // <== tinkerGraph 에서 직접 저장/로딩 (2018-10-08)
};