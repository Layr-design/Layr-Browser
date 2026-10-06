import type { ElementRef, Provenance, Rect } from './types.js';
export type MotionProperty = 'opacity' | 'translateX' | 'translateY' | 'translateZ' | 'scaleX' | 'scaleY' | 'rotateX' | 'rotateY' | 'rotateZ' | 'blur' | 'clipPath' | 'backgroundColor' | 'color' | 'width' | 'height' | 'borderRadius';
export interface MotionTiming { delay?: number; duration?: number; iterations?: number; easing?: string; playbackRate?: number }
export interface MotionKeyframe { offset: number; values: Partial<Record<MotionProperty, string | number>> }
export interface MotionAnimation { id: string; target?: ElementRef; source: 'css-animation' | 'css-transition' | 'web-animation' | 'script' | 'inferred'; playState?: string; timing?: MotionTiming; keyframes?: MotionKeyframe[]; effects?: MotionProperty[]; timeline?: { type: 'document' | 'scroll' | 'view'; source?: ElementRef | 'document' }; provenance: Provenance }
export interface MotionTransition { target: ElementRef; property: MotionProperty; timing?: MotionTiming; provenance: Provenance }
export interface ParallaxEffect { target: ElementRef; axis: 'x' | 'y'; scrollSource: ElementRef | 'document'; inputRange?: [number, number]; outputRange?: { translateX?: [number, number]; translateY?: [number, number]; scale?: [number, number]; rotate?: [number, number] }; provenance: Provenance }
export interface StickyBehavior { target: ElementRef; axis: 'x' | 'y'; offset?: number; container: ElementRef | 'document'; range?: { start: number; end: number }; provenance: Provenance }
export interface MotionObservation { animations: MotionAnimation[]; transitions: MotionTransition[]; scrollAnimations: MotionAnimation[]; parallaxEffects: ParallaxEffect[]; stickyElements: StickyBehavior[] }
export interface MotionSample { timestamp: number; target: ElementRef; bounds?: Rect; opacity?: number; transform?: string; provenance: Provenance }
export interface MotionGraph { nodes: { id: string; kind: 'trigger' | 'actor' | 'effect'; target?: ElementRef }[]; edges: { from: string; to: string }[] }
export interface ScrollScene { id: string; container: ElementRef | 'document'; range?: [number, number]; pinned?: ElementRef[]; actors: ElementRef[]; effects?: MotionProperty[] }
export interface ExperienceModel { metadata: { url: string; capturedAt: number }; sections?: ElementRef[]; elements: ElementRef[]; scroll?: { scenes: ScrollScene[] }; motion?: MotionObservation; scenes?: ScrollScene[]; timeline?: { timestamp: number; event: string }[] }
