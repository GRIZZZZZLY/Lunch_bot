import { motion } from 'framer-motion';

interface SlideIndicatorProps {
  total: number;
  current: number;
}

export const SlideIndicator = ({ total, current }: SlideIndicatorProps) => {
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {Array.from({ length: total }).map((_, index) => (
        <motion.div
          key={index}
          initial={false}
          animate={{
            width: index === current ? 32 : 8,
            backgroundColor: index === current 
              ? 'rgb(194, 65, 12)' // primary-food-500
              : 'rgb(209, 213, 219)' // gray-300
          }}
          transition={{ duration: 0.3 }}
          className="h-2 rounded-full"
        />
      ))}
    </div>
  );
};
