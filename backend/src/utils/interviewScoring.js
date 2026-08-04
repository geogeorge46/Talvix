const values={'strong-no-hire':1,'no-hire':2,hold:3,hire:4,'strong-hire':5};
export const calculateWeightedScore=(scores)=>{const weight=scores.reduce((sum,item)=>sum+item.weight,0);return weight?Math.min(100,Math.max(0,scores.reduce((sum,item)=>sum+(item.score/item.maximumScore)*item.weight,0)/weight*100)):0;};
export const aggregateRecommendation=(recommendations)=>{if(!recommendations.length)return 'hold';const average=recommendations.reduce((sum,item)=>sum+values[item],0)/recommendations.length;if(average<1.5)return 'strong-no-hire';if(average<2.5)return 'no-hire';if(average<3.5)return 'hold';if(average<4.5)return 'hire';return 'strong-hire';};
export const averageScore=(valuesList)=>valuesList.length?valuesList.reduce((a,b)=>a+b,0)/valuesList.length:null;
export const aggregateRoundFeedback = (feedbackList) => {
  if (!feedbackList || !feedbackList.length) {
    return {
      averageScore: null,
      finalRecommendation: 'hold',
      scoreDistribution: {},
      decisionSummary: 'No feedback submitted yet.'
    };
  }
  const scores = feedbackList.map(f => f.weightedScore).filter(s => s !== null && s !== undefined);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const recommendations = feedbackList.map(f => f.recommendation).filter(Boolean);
  const finalRec = aggregateRecommendation(recommendations);
  
  const scoreDistribution = {};
  for (const rec of recommendations) {
    scoreDistribution[rec] = (scoreDistribution[rec] || 0) + 1;
  }
  
  const distParts = Object.entries(scoreDistribution).map(([rec, count]) => `${count} ${rec}`);
  const decisionSummary = `${feedbackList.length} interviewer(s) submitted feedback (${distParts.join(', ')}). Aggregated recommendation: ${finalRec}. Average score: ${avgScore !== null ? avgScore.toFixed(2) + '%' : 'N/A'}.`;
  
  return {
    averageScore: avgScore,
    finalRecommendation: finalRec,
    scoreDistribution,
    decisionSummary
  };
};
