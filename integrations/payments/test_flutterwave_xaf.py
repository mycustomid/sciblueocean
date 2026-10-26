import importlib.util,unittest
from pathlib import Path
SPEC=importlib.util.spec_from_file_location('flw',Path(__file__).with_name('flutterwave_xaf.py'))
flw=importlib.util.module_from_spec(SPEC)
import sys
sys.modules['flw']=flw
SPEC.loader.exec_module(flw)
class TestPaymentAdapter(unittest.TestCase):
 def setUp(self):
  self.calls=[]
  def transport(method,path,data=None):
   self.calls.append((method,path,data))
   if method=='POST':return {'status':'success','data':{'id':77,'status':'pending'}}
   return {'status':'success','data':{'status':'successful','amount':80000,'currency':'XAF','tx_ref':'BO-PAY-ABCDEFGH'}}
  self.adapter=flw.FlutterwaveXAF('test_key','webhook_secret',transport)
 def test_create_network_xaf(self):
  res=self.adapter.create_mobile_money_charge(flw.Charge('BO-PAY-ABCDEFGH',80000,'guest@example.test','237670000000','MTN'))
  self.assertEqual(res['state'],'PENDING');self.assertEqual(self.calls[0][2]['country'],'CM');self.assertEqual(self.calls[0][2]['currency'],'XAF')
 def test_prevent_unknown_network(self):
  with self.assertRaises(ValueError):self.adapter.create_mobile_money_charge(flw.Charge('BO-PAY-ABCDEFGH',80000,'guest@example.test','237670000000','TEST'))
 def test_verify_transaction(self):
  self.assertEqual(self.adapter.verify_paid(77,'BO-PAY-ABCDEFGH',80000)['state'],'PAID_VERIFIED')
 def test_reject_wrong_amount(self):
  with self.assertRaises(flw.PaymentGatewayError):self.adapter.verify_paid(77,'BO-PAY-ABCDEFGH',40000)
 def test_reject_wrong_reference(self):
  with self.assertRaises(flw.PaymentGatewayError):self.adapter.verify_paid(77,'BO-PAY-OTHER',80000)
 def test_verify_webhook(self):
  self.assertTrue(self.adapter.validate_webhook({'Verif-Hash':'webhook_secret'}));self.assertFalse(self.adapter.validate_webhook({'verif-hash':'wrong'}))
if __name__=='__main__':unittest.main()
