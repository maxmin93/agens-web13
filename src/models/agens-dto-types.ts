import { StateType, RequestType } from '../global.config';
import { IGraphType, ILabelType } from './agens-ddl-types';
import { IGraph, IRecord } from './agens-dml-types';

export interface IResponseDto {

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
  user_name: string;
  user_ip: string;
  timestamp: string;
  valid: boolean;

};

export interface IMetaDto extends IResponseDto {

  is_dirty: boolean;
  graph: IGraphType;
  labels: Array<ILabelType>;
  meta: IGraph;

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
