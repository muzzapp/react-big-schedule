// @ts-nocheck

import { DropTarget, DropTargetMonitor, DropTargetConnector } from "react-dnd";
import {
  DnDTypes,
  CellUnit,
  DATETIME_FORMAT,
  ViewType,
} from "../config/default";
import { getPos } from "../helper/utility";
import dayjs, { Dayjs } from "dayjs";
import { SchedulerData } from "../components/Scheduler";
import {
  EventItemType,
  RenderDataItem,
  ResourceEvent,
} from "../types/baseType";
import { DnDSource } from "./DnDSource";
// Types in this in this file have been generated by AI and are not accurate. Please replace them with the correct types.

interface DnDContextProps {
  schedulerData: SchedulerData;
  resourceEvents: RenderDataItem;
  movingEvent?: (
    schedulerData: SchedulerData,
    slotId: string,
    slotName: string,
    newStart: Dayjs,
    newEnd: Dayjs,
    action: string,
    type: DnDTypes,
    item: EventItemType
  ) => void;
}

export class DnDContext {
  private sourceMap: Map<string, DnDSource>;
  private DecoratedComponent: React.ComponentType<any>;
  private config: any;

  constructor(
    sources: DnDSource[],
    DecoratedComponent: React.ComponentType<any>
  ) {
    this.sourceMap = new Map();
    sources.forEach((item) => {
      this.sourceMap.set(item.dndType, item);
    });
    this.DecoratedComponent = DecoratedComponent;
  }

  extractInitialTimes = (
    monitor: DropTargetMonitor,
    pos: { x: number; y: number },
    cellWidth: number,
    resourceEvents: RenderDataItem,
    cellUnit: CellUnit,
    localeDayjs: typeof dayjs
  ) => {
    const initialPoint = monitor.getInitialClientOffset();
    let initialStart = localeDayjs();
    let initialEnd = localeDayjs();
    if (!initialPoint) return { initialStart, initialEnd };
    const initialLeftIndex = Math.floor((initialPoint.x - pos.x) / cellWidth);

    if (resourceEvents.headerItems[initialLeftIndex]?.start) {
      initialStart = resourceEvents.headerItems[initialLeftIndex].start;
    }
    if (resourceEvents.headerItems[initialLeftIndex]?.end) {
      let initialEnd = resourceEvents.headerItems[initialLeftIndex]?.end;
      if (cellUnit !== CellUnit.Hour) {
        var end = initialStart.hour(23).minute(59).second(59);
        initialEnd = end;
      }
    }
    return { initialStart, initialEnd };
  };

  getDropSpec = () => ({
    drop: (
      props: DnDContextProps,
      monitor: DropTargetMonitor,
      component: any
    ) => {
      const { schedulerData, resourceEvents } = props;
      const { cellUnit, localeDayjs } = schedulerData;
      const type = monitor.getItemType();
      const pos = getPos(component.eventContainer);
      const cellWidth = schedulerData.getContentCellWidth();
      let initialStartTime = null;
      let initialEndTime = null;
      if (type === DnDTypes.EVENT) {
        const { initialStart, initialEnd } = this.extractInitialTimes(
          monitor,
          pos,
          cellWidth,
          resourceEvents,
          cellUnit,
          localeDayjs
        );
        initialStartTime = initialStart;
        initialEndTime = initialEnd;
      }
      const point = monitor.getClientOffset();
      if (!point) return null;
      const leftIndex = Math.floor((point.x - pos.x) / cellWidth);
      const startTime =
        resourceEvents.headerItems[leftIndex]?.start || localeDayjs();
      let endTime = resourceEvents.headerItems[leftIndex]?.end || localeDayjs();
      if (cellUnit !== CellUnit.Hour) {
        endTime = (
          resourceEvents.headerItems[leftIndex]?.start || localeDayjs()
        )
          .hour(23)
          .minute(59)
          .second(59);
      }

      return {
        slotId: resourceEvents.slotId,
        slotName: resourceEvents.slotName,
        start: startTime,
        end: endTime,
        initialStart: initialStartTime,
        initialEnd: initialEndTime,
      };
    },

    hover: (
      props: DnDContextProps,
      monitor: DropTargetMonitor,
      component: any
    ) => {
      const { schedulerData, resourceEvents, movingEvent } = props;
      const { cellUnit, config, viewType, localeDayjs } = schedulerData;
      this.config = config;
      const item: EventItemType = monitor.getItem();
      const type = monitor.getItemType() as DnDTypes;
      const pos = getPos(component.eventContainer);
      const cellWidth = schedulerData.getContentCellWidth();
      let initialStart = null;
      if (type === DnDTypes.EVENT) {
        const { initialStart: iStart } = this.extractInitialTimes(
          monitor,
          pos,
          cellWidth,
          resourceEvents,
          cellUnit,
          localeDayjs
        );
        initialStart = iStart;
      }

      const point = monitor.getClientOffset();
      if (!point) return;
      const leftIndex = Math.floor((point.x - pos.x) / cellWidth);
      if (!resourceEvents.headerItems[leftIndex]) {
        return;
      }
      let newStart = resourceEvents.headerItems[leftIndex].start;
      let newEnd = resourceEvents.headerItems[leftIndex].end;
      if (cellUnit !== CellUnit.Hour) {
        newEnd = (resourceEvents.headerItems[leftIndex].start || localeDayjs())
          .hour(23)
          .minute(59)
          .second(59);
      }
      let { slotId, slotName } = resourceEvents;
      let action = "New";
      const isEvent = type === DnDTypes.EVENT;
      if (isEvent) {
        const event = item;
        if (config.relativeMove) {
          newStart = event.start.add(newStart.diff(initialStart), "ms");
        } else if (viewType !== ViewType.Day) {
          const tmpDayjs = localeDayjs(newStart);
          newStart = event.start
            .year(tmpDayjs.year())
            .month(tmpDayjs.month())
            .date(tmpDayjs.date());
        }
        newEnd = localeDayjs(newStart).add(event.end.diff(event.start), "ms");

        if (config.crossResourceMove === false) {
          slotId = schedulerData._getEventSlotId(item);
          // @ts-ignore TODO: Fix this type
          slotName = undefined;
          const slot = schedulerData.getSlotById(slotId);
          if (slot) slotName = slot.name;
        }

        action = "Move";
      }

      if (movingEvent) {
        movingEvent(
          schedulerData,
          slotId,
          slotName,
          newStart,
          newEnd,
          action,
          type,
          item
        );
      }
    },

    canDrop: (props: DnDContextProps, monitor: DropTargetMonitor) => {
      const { schedulerData, resourceEvents } = props;
      const item: EventItemType = monitor.getItem();
      if (schedulerData._isResizing()) return false;
      const { config } = schedulerData;
      return (
        config.movable &&
        !resourceEvents.groupOnly &&
        (item.movable === undefined || item.movable !== false)
      );
    },
  });

  getDropCollect = (
    connect: DropTargetConnector,
    monitor: DropTargetMonitor
  ) => ({
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver(),
  });

  getDropTarget = (dragAndDropEnabled: boolean) =>
    dragAndDropEnabled
      ? DropTarget(
          [...this.sourceMap.keys()],
          this.getDropSpec(),
          this.getDropCollect
        )(this.DecoratedComponent)
      : this.DecoratedComponent;

  getDndSource = (dndType: string = DnDTypes.EVENT) =>
    this.sourceMap.get(dndType);
}
