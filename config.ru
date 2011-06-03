require 'rack/contrib'
require 'rack-rewrite'

use Rack::CommonLogger
use Rack::Static, :urls => [/.{2,}/], :root => "public"
use Rack::ETag
use Rack::Rewrite do
    rewrite /.*/, '/index.html', :if => Proc.new {|rack_env| rack_env['REQUEST_PATH'] == "/" || ! File.exists?("public#{rack_env['REQUEST_PATH']}")}
end
run Rack::Directory.new('public')
