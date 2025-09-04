// GlassCard.tsx
import * as React from "react";

/**
 * GlassCard (glass + inset)
 * - glass: translucent with tint/blur/shadow, optional interactive motion; includes "chrome" effects
 * - inset: pressed/inner-shadow; non-interactive; no chrome
 * Layout (flex/grid/etc.) is consumer's responsibility via className.
 */

type Size = "sm" | "md" | "lg";
type Shadow = "none" | "sm" | "lg";
type Depth = "sm" | "md" | "lg";
type BlurStrength = "sm" | "md" | "lg";

type BaseProps = Omit<React.HTMLAttributes<HTMLDivElement>, "color"> & {
  size?: Size;
  className?: string;
  children?: React.ReactNode;
};

type GlassVariantProps = BaseProps & {
  surface: "glass";
  interactive?: boolean;         // enables hover/active scale
  tint?: string;                 // CSS color (ideally translucent)
  blurStrength?: BlurStrength;   // backdrop blur level
  shadow?: Shadow;               // outer shadow  p+
};

type InsetVariantProps = BaseProps & {
  surface: "inset";
  interactive?: false;           // intentionally not interactive
  depth?: Depth;                 // inner shadow intensity
};

export type GlassCardProps = GlassVariantProps | InsetVariantProps;

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const sizePad: Record<Size, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const blurCls: Record<BlurStrength, string> = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur",
  lg: "backdrop-blur-lg",
};

const shadowCls: Record<Shadow, string> = {
  none: "shadow-none",
  sm: "shadow-lg",
  lg: "shadow-xl",
};

const insetDepthCls: Record<Depth, string> = {
  sm: "shadow-inner shadow-[inset_3px_3px_8px_rgba(0,0,0,0.4)]",
  md: "shadow-inner shadow-[inset_4px_4px_12px_rgba(0,0,0,0.45),inset_-4px_-4px_12px_rgba(255,255,255,0.12)]",
  lg: "shadow-inner shadow-[inset_6px_6px_16px_rgba(0,0,0,0.4),inset_-6px_-6px_16px_rgba(255,255,255,0.15)]",
};

const motionInteractiveBase =
  "cursor-pointer transition-transform duration-200 will-change-transform";
const motionScale = "hover:scale-[1.03] active:scale-[0.98]";

// Anti-aliasing classes to prevent blurriness during transforms
const antiAlias = "transform-gpu backface-hidden perspective-1000";

// "Chrome" (glass only): reflection (::before) + bottom highlight (::after)
const chromeBase =
  'before:content-[""] before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/20 before:to-transparent ' +
  'after:content-[""] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.35),transparent)]';

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (props, ref) => {
    const { size = "md", className, children, style, ...rest } =
      props as GlassCardProps;

    const base = cx(
      "relative overflow-hidden rounded-2xl transition-all duration-300",
      sizePad[size],
      antiAlias
    );

    if (props.surface === "glass") {
      const {
        interactive = false,
        tint,
        blurStrength = "md",
        shadow = "sm",
        ...divProps
      } = rest as Omit<GlassVariantProps, keyof BaseProps>;

      const classes = cx(
        base,
        cx("bg-white/10 border border-white/20", blurCls[blurStrength], shadowCls[shadow]),
        interactive && cx(motionInteractiveBase, motionScale, "hover:border-white/30"),
        chromeBase, // always on for glass
        className
      );

      const inlineStyles: React.CSSProperties = {
        ...(style || {}),
        ...(tint ? { backgroundColor: tint } : null),
      };

      return (
        <div ref={ref} className={classes} style={inlineStyles} {...divProps}>
          {children}
        </div>
      );
    }

    // INSET (no chrome, no interactive motion)
    {
      const { depth = "md", ...divProps } = rest as Omit<
        InsetVariantProps,
        keyof BaseProps
      >;

      const classes = cx(
        base,
        cx("bg-white/5 border border-white/20", insetDepthCls[depth]),
        className
      );

      return (
        <div ref={ref} className={classes} style={style} {...divProps}>
          {children}
        </div>
      );
    }
  }
);

GlassCard.displayName = "GlassCard";
export default GlassCard;
