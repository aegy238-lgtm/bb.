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
      };
    };
    // Keep backward compatibility just in case, though we primarily use SVGA now
    svga: any; 
    
    // Lottie Web types
    lottie: {
      loadAnimation: (params: {
        container: Element;
        renderer: 'svg' | 'canvas' | 'html';
        loop: boolean;
        autoplay: boolean;
        animationData?: any;
        path?: string;
      }) => any; // Returns AnimationItem
      destroy: (name?: string) => void;
      stop: (name?: string) => void;
      play: (name?: string) => void;
    };
  }
}