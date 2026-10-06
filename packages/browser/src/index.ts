export { createBrowser } from './browser.js';
export { BrowserError } from './errors.js';
export { diffObservations } from './diff.js';
export { serializeObservation } from './serialize.js';
export type { Browser, BrowserOptions } from './browser.js';
export type { BrowserDriver, BrowserDriverCapabilities, RawNode, RawPage, DriverNodeRef } from './driver.js';
export type { BrowserObservation, BrowserSession, SemanticElement, ElementRef, ElementTarget, SemanticLocator, ActionResult, PageDiff, ObserveOptions, WaitCondition, WaitResult, BrowserImage, Provenance, TypeInput, KeyboardInput, ScrollInput, WaitOptions, ScrollState, ViewportState, Rect, Point } from './types.js';
export type { MotionObservation, MotionAnimation, MotionSample, ParallaxEffect, StickyBehavior, MotionGraph, ExperienceModel } from './motion.js';
export type { BrowserEvent } from './events.js';
