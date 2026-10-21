import importlib.util,pathlib,tempfile,threading,unittest,urllib.request,urllib.error,json
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('helper',pathlib.Path(__file__).with_name('audio-helper.py'));helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
class SecurityTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.server=helper.Helper(('127.0.0.1',0),self.temp.name,'ffmpeg');self.server.device='test';self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start();self.base='http://127.0.0.1:'+str(self.server.server_port)
 def tearDown(self):self.server.shutdown();self.server.server_close();self.server.pool.shutdown();self.temp.cleanup()
 def request(self,path,origin='https://voxxxi.github.io',token='valid',method='GET',body=None):
  req=urllib.request.Request(self.base+path,data=body,method=method,headers={'Origin':origin,'Authorization':'Bearer '+token})
  try:
   with urllib.request.urlopen(req) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
 def test_foreign_origin_denied_before_authentication(self):
  with patch.object(helper,'staff_identity') as auth:self.assertEqual(self.request('/health',origin='https://attacker.invalid')[0],403);auth.assert_not_called()
 def test_invalid_session_denied(self):
  with patch.object(helper,'staff_identity',side_effect=PermissionError('denied')):self.assertEqual(self.request('/health')[0],403)
 def test_private_result_cannot_be_downloaded_by_other_staff(self):
  self.server.jobs['11111111-1111-4111-8111-111111111111']={'actor':'owner','state':'done'}
  with patch.object(helper,'staff_identity',return_value='other'):self.assertEqual(self.request('/jobs/11111111-1111-4111-8111-111111111111/instrumental')[0],404)
 def test_paths_and_empty_upload_rejected(self):
  with patch.object(helper,'staff_identity',return_value='owner'):
   self.assertEqual(self.request('/jobs/../../secret')[0],404);self.assertEqual(self.request('/jobs',method='POST',body=b'')[0],413);self.assertEqual(self.request('/health')[0],200)
 def test_completed_job_status_has_no_private_paths(self):
  self.server.jobs['11111111-1111-4111-8111-111111111111']={'id':'11111111-1111-4111-8111-111111111111','actor':'owner','state':'done','folder':'private-location'}
  with patch.object(helper,'staff_identity',return_value='owner'):
   code,data=self.request('/jobs/11111111-1111-4111-8111-111111111111');self.assertEqual(code,200);self.assertNotIn('folder',data);self.assertNotIn('actor',data)
if __name__=='__main__':unittest.main()
