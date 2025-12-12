import React, { useState } from 'react';
import { X, Briefcase, MapPin, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { JobPosition } from '../types';
import { JOB_POSITIONS } from '../constants';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface JobsModalProps {
  onClose: () => void;
}

const JobsModal: React.FC<JobsModalProps> = ({ onClose }) => {
  const [appliedJobs, setAppliedJobs] = useState<number[]>([]);
  const [loadingIds, setLoadingIds] = useState<number[]>([]);

  const handleApply = async (job: JobPosition) => {
    try {
      setLoadingIds(prev => [...prev, job.id]);
      
      // Save application to Firestore
      await addDoc(collection(db, "job_applications"), {
        jobId: job.id,
        jobTitle: job.title,
        department: job.department,
        appliedAt: serverTimestamp(),
        status: 'pending'
      });

      setAppliedJobs(prev => [...prev, job.id]);
    } catch (error) {
      console.error("Error applying for job:", error);
      alert("Something went wrong. Please check your connection.");
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== job.id));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border border-[#333] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1a1a1a] bg-[#0f0f0f]">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase className="text-blue-500" />
              Join the Team
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Help us build the future of animation tools.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[#222] rounded-full text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {JOB_POSITIONS.map((job) => {
            const isApplied = appliedJobs.includes(job.id);
            const isLoading = loadingIds.includes(job.id);

            return (
              <div 
                key={job.id}
                className="group relative bg-[#111] border border-[#222] rounded-xl p-5 hover:border-blue-500/30 transition-all hover:bg-[#151515]"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors">
                        {job.title}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-[#222] text-gray-400 border border-[#333]">
                        {job.department}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {job.type}
                      </div>
                    </div>

                    <p className="text-sm text-gray-400 leading-relaxed">
                      {job.description}
                    </p>
                  </div>

                  <div className="flex items-center self-start md:self-center mt-2 md:mt-0">
                    <button
                      onClick={() => !isApplied && !isLoading && handleApply(job)}
                      disabled={isApplied || isLoading}
                      className={`
                        flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all min-w-[120px] justify-center
                        ${isApplied 
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20 cursor-default' 
                          : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                        }
                      `}
                    >
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isApplied ? (
                        <>
                          <CheckCircle size={16} />
                          Applied
                        </>
                      ) : (
                        'Apply Now'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1a1a1a] bg-[#0f0f0f] text-center text-xs text-gray-600">
          مصمم برستيج is an equal opportunity employer.
        </div>
      </div>
    </div>
  );
};

export default JobsModal;