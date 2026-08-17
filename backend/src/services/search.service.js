import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { Application } from '../models/Application.js';

export const executeGlobalSearch = async (queryText, user) => {
  const results = [];
  if (!queryText || queryText.trim() === '') {
    return results;
  }

  const searchRegex = new RegExp(queryText, 'i');
  const role = user.role;

  if (role === 'admin') {
    // 1. Search Users
    const users = await User.find({
      $or: [
        { fullName: searchRegex },
        { email: searchRegex }
      ]
    }).limit(5).lean();
    users.forEach(u => {
      results.push({
        id: u._id.toString(),
        title: u.fullName,
        subtitle: u.email,
        type: 'User',
        url: `/admin/operations/users/${u._id}`
      });
    });

    // 2. Search Companies
    const companies = await Company.find({ name: searchRegex }).limit(5).lean();
    companies.forEach(c => {
      results.push({
        id: c._id.toString(),
        title: c.name,
        subtitle: `Slug: ${c.slug}`,
        type: 'Company',
        url: `/admin/operations/companies/${c._id}`
      });
    });

    // 3. Search Jobs
    const jobs = await Job.find({ title: searchRegex }).limit(5).lean();
    jobs.forEach(j => {
      results.push({
        id: j._id.toString(),
        title: j.title,
        subtitle: `Job ID: ${j._id}`,
        type: 'Job',
        url: `/admin/operations/jobs/${j._id}`
      });
    });
  } else if (role === 'recruiter') {
    // Find recruiter profile
    const recruiterProfile = await RecruiterProfile.findOne({ user: user._id || user.id });
    if (recruiterProfile && recruiterProfile.company) {
      const companyId = recruiterProfile.company;

      // 1. Search Jobs in company
      const jobs = await Job.find({ company: companyId, title: searchRegex }).limit(5).lean();
      jobs.forEach(j => {
        results.push({
          id: j._id.toString(),
          title: j.title,
          subtitle: `Status: ${j.status}`,
          type: 'Job',
          url: `/org/jobs/${j._id}`
        });
      });

      // 2. Search Applications in company
      const companyJobs = await Job.find({ company: companyId }).select('_id');
      const companyJobIds = companyJobs.map(j => j._id);

      const applications = await Application.find({
        job: { $in: companyJobIds }
      })
      .populate('candidate', 'fullName email')
      .populate('job', 'title')
      .lean();

      // Filter applications where candidate name matches regex
      const matchingApps = applications.filter(app => 
        app.candidate && (
          searchRegex.test(app.candidate.fullName) || 
          searchRegex.test(app.candidate.email)
        )
      ).slice(0, 5);

      matchingApps.forEach(app => {
        results.push({
          id: app._id.toString(),
          title: app.candidate.fullName,
          subtitle: `Applied to: ${app.job.title} (${app.status})`,
          type: 'Candidate',
          url: `/org/jobs/${app.job._id}/applications/${app._id}`
        });
      });
    }
  } else if (role === 'candidate') {
    // Candidates can search published jobs
    const jobs = await Job.find({ status: 'published', title: searchRegex }).populate('company', 'name').limit(5).lean();
    jobs.forEach(j => {
      results.push({
        id: j._id.toString(),
        title: j.title,
        subtitle: j.company?.name || 'Unknown Company',
        type: 'Job',
        url: `/candidate/jobs/${j._id}`
      });
    });
  }

  return results;
};
