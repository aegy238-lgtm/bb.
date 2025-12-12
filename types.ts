import { LucideIcon } from 'lucide-react';

export interface FeatureItem {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string; // Tailwind class for text color
}

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  highlight?: boolean;
}

export interface JobPosition {
  id: number;
  title: string;
  department: string;
  type: string;
  location: string;
  description: string;
}

declare global {
  interface Window {
    SVGA: {
      Parser: new () => {
        do: (data: Uint8Array) => Promise<any>;
      };
      Player: new (canvas: string | HTMLCanvasElement) => {
        mount: (videoItem: any) => Promise<void>;
        start: () => void;
        pause: () => void;
        stop: () => void;
        step: (frame: number) => void;
        clear: () => void;
        destroy: () => void;
        set: (options: { loop?: number; fillMode?: string }) => void;
        setImage?: (url: string, key: string) => void; 
        drawer: {
           draw: (frame: number) => void;
        };
      };
    };
    // Keep backward compatibility just in case, though we primarily use SVGA now
    svga: any; 
    
    // JSZip global
    JSZip: any;

    // Lottie Web types
    lottie: {
      loadAnimation: (params: {
        container?: Element;
        renderer?: 'svg' | 'canvas' | 'html';
        loop?: boolean | number;
        autoplay?: boolean;
        animationData?: any;
        path?: string;
        rendererSettings?: {
          preserveAspectRatio?: string;
          context?: any;
          clearCanvas?: boolean;
          className?: string;
          id?: string;
          [key: string]: any;
        };
      }) => any; // Returns AnimationItem
      destroy: (name?: string) => void;
      stop: (name?: string) => void;
      play: (name?: string) => void;
    };

    // FFmpeg v0.11 global
    FFmpeg: {
      createFFmpeg: (options?: { log?: boolean; corePath?: string; logger?: (msg: any) => void }) => any;
      fetchFile: (file: File | Blob | string) => Promise<Uint8Array>;
    };
  }
}