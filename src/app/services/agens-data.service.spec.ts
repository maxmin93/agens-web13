import { TestBed, inject } from '@angular/core/testing';

import { AgensDataService } from './agens-data.service';

describe('AgensDataService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AgensDataService]
    });
  });

  it('should be created', inject([AgensDataService], (service: AgensDataService) => {
    expect(service).toBeTruthy();
  }));
});
