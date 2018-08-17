import { TestBed, inject } from '@angular/core/testing';

import { AgensGraphService } from './agens-graph.service';

describe('AgensGraphService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AgensGraphService]
    });
  });

  it('should be created', inject([AgensGraphService], (service: AgensGraphService) => {
    expect(service).toBeTruthy();
  }));
});
