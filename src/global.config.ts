export const DEV_MODE: boolean = true;  // false if integration version

///////////////////////////////////////////////////////////////

export const AGENS_CORE_API: string = 'api/core';
export const AGENS_MNGR_API: string = 'api/manager';
export const AGENS_AUTH_API: string = 'api/auth';

export const USER_KEY: string = 'agensUser';

export const MOBILE_WIDTH: number = 1024;

///////////////////////////////////////////////////////////////

export enum StateType { 
  PENDING='PENDING', SUCCESS='SUCCESS', FAIL='FAIL', KILLED='KILLED', ERROR='ERROR', NONE='NONE' 
};
export enum RequestType { 
  CREATE='CREATE', DROP='DROP', QUERY='QUERY', KILL='KILL', NONE='NONE' 
};
export enum ValueType { 
  NODE='NODE', EDGE='EDGE', GRAPH='GRAPH', ID='ID', NUMBER='NUMBER', STRING='STRING'
  , ARRAY='ARRAY', OBJECT='OBJECT', BOOLEAN='BOOLEAN', NULL='NULL' 
};
export enum ElemType { 
  EDGE='EDGE', NODE='NODE', NONE='NONE' 
};
