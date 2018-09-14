/*
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */

import { Component, ComponentRef, ElementRef, Inject, OnDestroy } from '@angular/core';
import { Type } from '@angular/core/src/type';
import { takeWhile } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';

import {
  NbAdjustableConnectedPositionStrategy,
  NbAdjustment,
  NbComponentPortal,
  NbOverlayRef,
  NbOverlayService,
  NbPosition,
  NbPositionBuilderService,
  NbTrigger,
  NbTriggerStrategy,
  NbTriggerStrategyBuilder,
  patch,
} from '../cdk';
import { NbDatepickerContainerComponent } from './datepicker-container.component';
import { NB_DOCUMENT } from '../../theme.options';
import { NbCalendarRange, NbCalendarRangeComponent } from '../calendar/calendar-range.component'
import { NbCalendarComponent } from '../calendar/calendar.component';


export abstract class NbDatepicker<T> {
  abstract set value(value: T);

  abstract get value(): T;

  abstract get valueChange(): Observable<T>;

  abstract attach(hostRef: ElementRef);
}

export abstract class NbBasePicker<T, P> extends NbDatepicker<T> implements OnDestroy {
  protected abstract pickerClass: Type<P>;
  protected ref: NbOverlayRef;
  protected container: ComponentRef<NbDatepickerContainerComponent>;
  protected positionStrategy: NbAdjustableConnectedPositionStrategy;
  protected hostRef: ElementRef;
  protected onChange$: Subject<T> = new Subject();
  protected pickerRef: ComponentRef<P>;
  protected alive: boolean = true;
  protected queue: T;

  constructor(@Inject(NB_DOCUMENT) protected document,
              protected positionBuilder: NbPositionBuilderService,
              protected overlay: NbOverlayService) {
    super();
  }

  get picker(): P {
    return this.pickerRef && this.pickerRef.instance;
  }

  get valueChange(): Observable<T> {
    return this.onChange$.asObservable();
  }

  protected abstract get pickerValueChange(): Observable<T>;

  ngOnDestroy() {
    this.alive = false;
    this.hide();
    this.ref.dispose();
  }

  attach(hostRef: ElementRef) {
    this.hostRef = hostRef;

    this.positionStrategy = this.createPositionStrategy();
    this.ref = this.overlay.create({
      positionStrategy: this.positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });
    this.subscribeOnPositionChange();
    this.subscribeOnTriggers();
  }

  show() {
    this.container = this.ref.attach(new NbComponentPortal(NbDatepickerContainerComponent));
    this.instantiatePicker();
    this.subscribeOnValueChange();
    this.writeQueue();
  }

  hide() {
    this.queue = this.value;
    this.ref.detach();
    this.container = null;
    this.pickerRef.destroy();
    this.pickerRef = null;
  }

  toggle() {
    if (this.ref && this.ref.hasAttached()) {
      this.hide();
    } else {
      this.show();
    }
  }

  protected abstract writeQueue();

  protected createPositionStrategy(): NbAdjustableConnectedPositionStrategy {
    return this.positionBuilder
      .connectedTo(this.hostRef)
      .position(NbPosition.BOTTOM)
      .adjustment(NbAdjustment.COUNTERCLOCKWISE);
  }

  protected subscribeOnPositionChange() {
    this.positionStrategy.positionChange
      .pipe(takeWhile(() => this.alive))
      .subscribe((position: NbPosition) => patch(this.container, { position }));
  }

  protected createTriggerStrategy(): NbTriggerStrategy {
    return new NbTriggerStrategyBuilder()
      .document(this.document)
      .trigger(NbTrigger.CLICK)
      .host(this.hostRef.nativeElement)
      .container(() => this.container)
      .build();
  }

  protected subscribeOnTriggers() {
    const triggerStrategy = this.createTriggerStrategy();
    triggerStrategy.show$.pipe(takeWhile(() => this.alive)).subscribe(() => this.show());
    triggerStrategy.hide$.pipe(takeWhile(() => this.alive)).subscribe(() => this.hide());
  }

  protected instantiatePicker() {
    this.pickerRef = this.container.instance.attach(new NbComponentPortal(this.pickerClass));
  }

  protected subscribeOnValueChange() {
    this.pickerValueChange.subscribe(date => {
      this.onChange$.next(date);
    });
  }
}


@Component({
  selector: 'nb-datepicker',
  template: '',
})
export class NbDatepickerComponent<D> extends NbBasePicker<D, NbCalendarComponent<D>> {
  protected pickerClass: Type<NbCalendarComponent<D>> = NbCalendarComponent;

  get value(): D {
    return this.picker.date;
  }

  set value(date: D) {
    if (!this.picker) {
      this.queue = date;
      return;
    }

    if (date) {
      this.picker.visibleDate = date;
      this.picker.date = date;
    }
  }

  protected writeQueue() {
    this.value = this.queue;
  }

  protected get pickerValueChange(): Observable<D> {
    return this.picker.dateChange;
  }
}

@Component({
  selector: 'nb-rangepicker',
  template: '',
})
export class NbRangepickerComponent<D> extends NbBasePicker<NbCalendarRange<D>, NbCalendarRangeComponent<D>> {
  protected pickerClass: Type<NbCalendarRangeComponent<D>> = NbCalendarRangeComponent;

  get value(): NbCalendarRange<D> {
    return this.picker.range;
  }

  set value(range: NbCalendarRange<D>) {
    if (!this.picker) {
      this.queue = range;
      return;
    }

    if (range) {
      this.picker.visibleDate = range && range.start;
      this.picker.range = range;
    }
  }

  protected writeQueue() {
    this.value = this.queue;
  }

  protected get pickerValueChange(): Observable<NbCalendarRange<D>> {
    return this.picker.rangeChange;
  }
}