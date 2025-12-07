import { Play, Zap, RefreshCw, Maximize2 } from 'lucide-react';
import { FeatureItem, JobPosition } from './types';

export const FEATURES: FeatureItem[] = [
  {
    title: "SVGA Preview",
    description: "Real-time preview of SVGA animation effects with playback control and timeline scrubbing.",
    icon: Play,
    iconColor: "text-blue-500"
  },
  {
    title: "Smart Compression",
    description: "Intelligent compression algorithm that significantly reduces file size while maintaining quality.",
    icon: Zap,
    iconColor: "text-red-500"
  },
  {
    title: "Format Conversion",
    description: "Support conversion to GIF, WebP, APNG, VAP and many other formats.",
    icon: RefreshCw,
    iconColor: "text-green-500"
  },
  {
    title: "Size Adjustment",
    description: "Flexible animation size adjustment with proportional scaling and custom resolution support.",
    icon: Maximize2,
    iconColor: "text-cyan-400"
  }
];

export const JOB_POSITIONS: JobPosition[] = [
  {
    id: 1,
    title: "Senior WebGL Engineer",
    department: "Engineering",
    type: "Full-time",
    location: "Remote",
    description: "Lead the development of our core rendering engine and optimize SVGA playback performance."
  },
  {
    id: 2,
    title: "Product Designer (UI/UX)",
    department: "Design",
    type: "Full-time",
    location: "San Francisco, CA",
    description: "Shape the future of MotionTools interface and create intuitive workflows for animators."
  },
  {
    id: 3,
    title: "Animation Specialist",
    department: "Content",
    type: "Contract",
    location: "Remote",
    description: "Create high-quality SVGA templates and assist users with format conversion best practices."
  },
  {
    id: 4,
    title: "Frontend Developer",
    department: "Engineering",
    type: "Full-time",
    location: "Remote",
    description: "Build robust React components and ensure cross-browser compatibility for our web suite."
  }
];