import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OverlayGraphComponent } from './overlay-graph.component';

describe('OverlayGraphComponent', () => {
  let component: OverlayGraphComponent;
  let fixture: ComponentFixture<OverlayGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OverlayGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OverlayGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
