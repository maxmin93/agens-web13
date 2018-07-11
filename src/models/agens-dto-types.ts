import { StateType, RequestType } from '../global.config';
import { IGraphType, ILabelType } from './agens-ddl-types';
import { IGraph, IRecord } from './agens-dml-types';

export interface IResponseDto {
  group: string;
  state: StateType;   // enum Type
  message: string;
  _link?: string;

};

export interface ILabelDto extends IResponseDto {
  request?: IRequestDto;
  label: ILabelType;
};

export interface IClientDto extends IResponseDto {
  ssid: string;
  valid: boolean; 
  user_name: string;
  user_ip: string;
  product_name: string;
  product_version: string;
  timestamp: string;
};

export interface ISchemaDto extends IResponseDto {
  is_dirty: boolean;
  graph: IGraphType;
  labels: Array<ILabelType>;
  schema_graph: IGraph;
};

export interface IRequestDto {
  ssid: string;
  txid?: string;
  type: RequestType;
  sql: string;
  command?: string;
  options?: any; 
};

export interface IResultDto extends IResponseDto {
  request: IRequestDto;
  graph: IGraph;
  record: IRecord;
};
