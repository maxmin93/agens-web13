export const DEV_MODE: boolean = true;  // false if integration version

///////////////////////////////////////////////////////////////

export const AGENS_CORE_API: string = 'api/core';
export const AGENS_MNGR_API: string = 'api/manager';
export const AGENS_AUTH_API: string = 'api/auth';
export const AGENS_GRPH_API: string = 'api/graph';
export const AGENS_FILE_API: string = 'api/file';
export const AGENS_RPRT_API: string = 'api/report';

///////////////////////////////////////////////////////////////

export const USER_KEY: string = 'agens-ssid';
export const CLIENT_MODE_KEY: string = 'agens-mode';
export const ANIMATION_ENABLED_KEY: string = 'agens-animation-enabled';

export const MOBILE_WIDTH: number = 1024;
export const MAX_COLOR_SIZE:number = 40;

///////////////////////////////////////////////////////////////

export enum StateType { 
  PENDING='PENDING', SUCCESS='SUCCESS', FAIL='FAIL', KILLED='KILLED', WARNING='WARNING', ERROR='ERROR', NONE='NONE' 
};
export enum RequestType { 
  CREATE='CREATE', DROP='DROP', QUERY='QUERY', KILL='KILL', NONE='NONE', RENAME='RENAME', COMMENT='COMMENT'
};
export enum ValueType { 
  NODE='NODE', EDGE='EDGE', GRAPH='GRAPH', ID='ID', NUMBER='NUMBER', STRING='STRING'
  , ARRAY='ARRAY', OBJECT='OBJECT', BOOLEAN='BOOLEAN', NULL='NULL' 
};
